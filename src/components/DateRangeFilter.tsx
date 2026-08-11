import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Props {
  fromDate: Date | undefined;
  toDate: Date | undefined;
  onFromChange: (d: Date | undefined) => void;
  onToChange: (d: Date | undefined) => void;
}

export default function DateRangeFilter({ fromDate, toDate, onFromChange, onToChange }: Props) {
  return (
    <div className="flex gap-3 flex-wrap items-center">
      <span className="text-sm font-medium text-muted-foreground">From:</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-[180px] justify-start text-left font-normal', !fromDate && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {fromDate ? format(fromDate, 'dd MMM yyyy') : <span>Start date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={fromDate} onSelect={onFromChange} initialFocus className={cn('p-3 pointer-events-auto')} />
        </PopoverContent>
      </Popover>

      <span className="text-sm font-medium text-muted-foreground">To:</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-[180px] justify-start text-left font-normal', !toDate && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {toDate ? format(toDate, 'dd MMM yyyy') : <span>End date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={toDate} onSelect={onToChange} initialFocus className={cn('p-3 pointer-events-auto')} />
        </PopoverContent>
      </Popover>

      {(fromDate || toDate) && (
        <Button variant="ghost" size="sm" onClick={() => { onFromChange(undefined); onToChange(undefined); }}>
          Clear
        </Button>
      )}
    </div>
  );
}
