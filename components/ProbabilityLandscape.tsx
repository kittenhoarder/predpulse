/** Decorative, illustrative probability curves. No market values are implied. */
export default function ProbabilityLandscape() {
  return (
    <svg className="probability-landscape h-full w-full" viewBox="0 0 960 560" preserveAspectRatio="xMidYMid slice" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="landscape-teal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="landscape-teal-stop" stopOpacity="0.3" /><stop offset="1" className="landscape-teal-stop" stopOpacity="0" /></linearGradient>
        <linearGradient id="landscape-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="landscape-blue-stop" stopOpacity="0.15" /><stop offset="1" className="landscape-blue-stop" stopOpacity="0" /></linearGradient>
        <linearGradient id="landscape-amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="landscape-amber-stop" stopOpacity="0.17" /><stop offset="1" className="landscape-amber-stop" stopOpacity="0" /></linearGradient>
        <linearGradient id="landscape-fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" className="landscape-background-stop" stopOpacity="1" /><stop offset="0.45" className="landscape-background-stop" stopOpacity="0.62" /><stop offset="1" className="landscape-background-stop" stopOpacity="0" /></linearGradient>
      </defs>
      <g className="landscape-grid" fill="none" strokeWidth="1">
        <path d="M80 0V560 M240 0V560 M400 0V560 M560 0V560 M720 0V560 M880 0V560" />
        <path d="M0 100H960 M0 210H960 M0 320H960 M0 430H960" />
      </g>
      <g className="landscape-curves" strokeLinejoin="round" strokeLinecap="round">
        <path fill="url(#landscape-blue)" d="M0 430 C115 430 178 424 235 384 C285 347 301 286 339 286 C375 286 393 383 447 410 C510 437 600 430 960 430 Z" />
        <path className="landscape-blue-line" fill="none" strokeWidth="1.7" d="M0 430 C115 430 178 424 235 384 C285 347 301 286 339 286 C375 286 393 383 447 410 C510 437 600 430 960 430" />
        <path fill="url(#landscape-blue)" d="M0 430 C220 430 303 427 367 375 C417 337 438 240 480 240 C523 240 540 351 587 395 C634 433 709 430 960 430 Z" />
        <path className="landscape-blue-line" fill="none" strokeWidth="1.5" d="M0 430 C220 430 303 427 367 375 C417 337 438 240 480 240 C523 240 540 351 587 395 C634 433 709 430 960 430" />
        <path fill="url(#landscape-blue)" d="M0 430 C320 430 392 421 456 349 C500 296 526 211 568 211 C610 211 631 330 678 390 C714 432 787 430 960 430 Z" />
        <path className="landscape-blue-line" fill="none" strokeWidth="1.5" d="M0 430 C320 430 392 421 456 349 C500 296 526 211 568 211 C610 211 631 330 678 390 C714 432 787 430 960 430" />
        <path fill="url(#landscape-teal)" d="M0 430 C323 430 468 425 539 342 C605 265 630 88 681 88 C731 88 745 286 805 375 C838 424 893 430 960 430 Z" />
        <path className="landscape-teal-line" fill="none" strokeWidth="2" d="M0 430 C323 430 468 425 539 342 C605 265 630 88 681 88 C731 88 745 286 805 375 C838 424 893 430 960 430" />
        <path fill="url(#landscape-amber)" d="M0 430 C614 430 742 426 791 379 C825 346 835 270 863 270 C890 270 898 359 930 400 C945 421 950 429 960 430 Z" />
        <path className="landscape-amber-line" fill="none" strokeWidth="1.5" d="M0 430 C614 430 742 426 791 379 C825 346 835 270 863 270 C890 270 898 359 930 400 C945 421 950 429 960 430" />
      </g>
      <path className="landscape-baseline" d="M0 430H960" fill="none" strokeWidth="1" />
      <path fill="url(#landscape-fade)" d="M0 0H540V560H0Z" />
    </svg>
  );
}
