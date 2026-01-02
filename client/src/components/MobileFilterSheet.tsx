import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface MobileFilterSheetProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    title?: string;
    onApply?: () => void;
    onClear?: () => void;
}

export default function MobileFilterSheet({ 
    isOpen, 
    onClose, 
    children, 
    title = 'Filters',
    onApply,
    onClear
}: MobileFilterSheetProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 lg:hidden">
            <div 
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <div className="flex justify-center py-2">
                    <div className="w-10 h-1 bg-muted rounded-full" />
                </div>

                <div className="flex items-center justify-between px-4 py-2 border-b">
                    <button
                        onClick={onClear}
                        className="text-muted-foreground hover:text-foreground text-sm"
                        data-testid="button-clear-filters"
                    >
                        Clear
                    </button>
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        data-testid="button-close-filters"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {children}
                </div>

                <div className="p-4 border-t">
                    <Button
                        onClick={() => { onApply?.(); onClose(); }}
                        className="w-full"
                        data-testid="button-apply-filters"
                    >
                        Apply Filters
                    </Button>
                </div>
            </div>
        </div>
    );
}
