interface SwanLogoProps {
  className?: string;
  showText?: boolean;
}

export function SwanLogo({ className = 'h-12 w-12', showText = false }: SwanLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Swan Clinic"
      >
        {/* Swan body */}
        <path
          d="M32 8C25 8 18 12 14 18C12 22 11 26 12 30C13 34 16 36 19 36C22 36 24 34 25 32C26 28 28 24 32 22C36 24 38 28 39 32C40 34 42 36 45 36C48 36 51 34 52 30C53 26 52 22 50 18C46 12 39 8 32 8Z"
          fill="#00ADBE"
        />
        {/* Swan wing accent */}
        <path
          d="M32 28C30 28 28 30 28 32C28 36 30 38 32 38C34 38 36 36 36 32C36 30 34 28 32 28Z"
          fill="#C9A96E"
        />
        {/* Swan neck */}
        <path
          d="M32 38C30 42 28 46 27 50C26 54 27 56 30 56C32 56 33 54 33 52C33 50 32 46 32 44C32 46 31 50 31 52C31 54 32 56 34 56C37 56 38 54 37 50C36 46 34 42 32 38Z"
          fill="#00ADBE"
        />
      </svg>
      {showText && (
        <div className="flex flex-col">
          <span className="text-lg font-bold text-swan-600">SWAN</span>
          <span className="text-xs text-champagne-500">CASE CRM</span>
        </div>
      )}
    </div>
  );
}