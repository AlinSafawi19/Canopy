import { cn } from "@/lib/utils";

interface TableProps {
  children?: React.ReactNode;
  className?: string;
}

interface TableCellProps extends TableProps {
  colSpan?: number;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-sm text-left", className)}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className }: TableProps) {
  return (
    <thead className={cn("bg-slate-50 border-b border-slate-200", className)}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className }: TableProps) {
  return <tbody className={cn("divide-y divide-slate-100", className)}>{children}</tbody>;
}

export function TableRow({ children, className }: TableProps) {
  return (
    <tr className={cn("hover:bg-slate-50/80 transition-colors duration-100", className)}>
      {children}
    </tr>
  );
}

export function TableHead({ children, className }: TableProps) {
  return (
    <th className={cn("px-3 sm:px-4 py-2 sm:py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap", className)}>
      {children}
    </th>
  );
}

export function TableCell({ children, className, colSpan }: TableCellProps) {
  return (
    <td colSpan={colSpan} className={cn("px-3 sm:px-4 py-2 sm:py-3 text-slate-700", className)}>
      {children}
    </td>
  );
}
