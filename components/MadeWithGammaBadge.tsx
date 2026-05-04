import Image from "next/image";

export function MadeWithGammaBadge() {
  return (
    <a
      href="https://gamma.app"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block opacity-80 hover:opacity-100 transition-opacity"
      aria-label="Made with Gamma"
    >
      <Image
        src="/Made with Gamma badge for light themes.png"
        alt="Made with Gamma"
        width={160}
        height={38}
        className="block dark:hidden"
      />
      <Image
        src="/Made with Gamma badge for dark themes.png"
        alt="Made with Gamma"
        width={160}
        height={38}
        className="hidden dark:block"
      />
    </a>
  );
}
