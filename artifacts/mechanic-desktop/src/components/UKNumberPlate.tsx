import React from 'react';
import { Vehicle } from '@workspace/api-client-react';

interface UKNumberPlateProps {
  registration: string;
  className?: string;
}

export function UKNumberPlate({ registration, className = '' }: UKNumberPlateProps) {
  // Try to format UK plate: "AB12 CDE"
  const formattedReg = React.useMemo(() => {
    const clean = registration.replace(/\s+/g, '').toUpperCase();
    if (clean.length === 7) {
      return `${clean.substring(0, 4)} ${clean.substring(4)}`;
    }
    return clean;
  }, [registration]);

  return (
    <div 
      className={`inline-flex items-center justify-center bg-[#FFF9C4] border-2 border-[#E6D800] rounded-md px-3 py-1 shadow-sm ${className}`}
    >
      <span className="text-[#1A1A00] font-mono font-bold text-lg tracking-[0.15em] uppercase">
        {formattedReg}
      </span>
    </div>
  );
}
