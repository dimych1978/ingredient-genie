import type { SVGProps } from 'react';

export const Icons = {
  logo: (props: SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 3v18" />
      <path d="M7 3h10" />
      <path d="M12 12.5a3.5 3.5 0 0 0-3.5 3.5" />
      <path d="M12 12.5a3.5 3.5 0 0 1 3.5 3.5" />
      <path d="M12 5.5a3.5 3.5 0 0 0-3.5-3.5h-1" />
      <path d="M12 5.5a3.5 3.5 0 0 1 3.5-3.5h1" />
    </svg>
  ),
};
