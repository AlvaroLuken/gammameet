import { supabase } from "./supabase";

// Bucket where archived deck PDFs live permanently. Public so anyone with
// the share link can view, matching the existing /share/[id] privacy model.
const DECKS_BUCKET = "decks";

let bucketEnsured = false;
async function ensureBucket() {
  if (bucketEnsured) return;
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === DECKS_BUCKET)) {
    await supabase.storage.createBucket(DECKS_BUCKET, { public: true });
  }
  bucketEnsured = true;
}

// Returns true if the URL is already hosted on our own Supabase Storage —
// no point re-archiving (would also fail because the source is the
// destination).
function isAlreadyArchived(url: string): boolean {
  try {
    const u = new URL(url);
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    return u.hostname === base.hostname && u.pathname.includes(`/storage/v1/object/public/${DECKS_BUCKET}/`);
  } catch {
    return false;
  }
}

// Download a Gamma-issued presigned PDF URL and upload it to our own storage
// so the deck survives Gamma's S3 presign expiry (~2 weeks). Returns the
// permanent public URL. If the upload fails for any reason we return the
// original Gamma URL — caller still gets a working short-term link and the
// failure is logged. Existing archived URLs are returned unchanged.
export async function archiveGammaPdf(gammaExportUrl: string, meetingId: string): Promise<string> {
  if (isAlreadyArchived(gammaExportUrl)) return gammaExportUrl;

  try {
    await ensureBucket();

    const upstream = await fetch(gammaExportUrl, {
      headers: { "User-Agent": "GammaMeet/1.0" },
    });
    if (!upstream.ok) {
      console.warn(`archiveGammaPdf: upstream ${upstream.status} for ${gammaExportUrl}`);
      return gammaExportUrl;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());

    // Overwrite is fine — meetingId is stable per meeting and regenerate
    // should always replace the previous archive.
    const path = `${meetingId}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from(DECKS_BUCKET)
      .upload(path, buf, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr) {
      console.warn("archiveGammaPdf: upload failed:", uploadErr);
      return gammaExportUrl;
    }

    const { data } = supabase.storage.from(DECKS_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn("archiveGammaPdf: unexpected error, falling back to Gamma URL:", err);
    return gammaExportUrl;
  }
}
