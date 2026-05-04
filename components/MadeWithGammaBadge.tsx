import Image from "next/image";

export function MadeWithGammaBadge() {
  return (
    <a
      href="https://gamma.app"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block hover:opacity-90 transition-opacity"
      aria-label="Made with Gamma"
    >
      <Image
        src="/Made with Gamma badge for light themes.png"
        alt="Made with Gamma"
        width={220}
        height={53}
        className="block dark:hidden"
      />
      <Image
        src="/Made with Gamma badge for dark themes.png"
        alt="Made with Gamma"
        width={220}
        height={53}
        className="hidden dark:block"
      />
    </a>
  );
}
