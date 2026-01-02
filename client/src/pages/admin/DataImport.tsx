import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Upload, Database, ArrowLeft, CheckCircle, AlertCircle, Clock, FileText, X } from 'lucide-react';

interface ImportBatch {
    id: number;
    batch_name: string;
    source_type: string;
    source_name: string;
    status: string;
    total_records: number;
    imported_records: number;
    error_records: number;
    created_at: string;
}

interface ImportRecord {
    id: number;
    name: string;
    city: string;
    status: string;
    matched_property_id: number | null;
    confidence_score: number | null;
    processing_notes: string;
}

interface DataSource {
    id: number;
    name: string;
    source_type: string;
    url: string;
    update_frequency: string;
    last_imported_at: string | null;
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'completed':
        case 'imported':
        case 'matched':
            return <Badge className="bg-green-600">{status}</Badge>;
        case 'pending':
        case 'pending_review':
            return <Badge className="bg-blue-600">{status}</Badge>;
        case 'processing':
        case 'review':
            return <Badge className="bg-yellow-600">{status}</Badge>;
        case 'new':
            return <Badge className="bg-purple-600">{status}</Badge>;
        case 'error':
        case 'failed':
        case 'completed_with_errors':
            return <Badge variant="destructive">{status}</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

export default function DataImport() {
    const { user, loading: authLoading } = useAuth();
    const [batches, setBatches] = useState<ImportBatch[]>([]);
    const [sources, setSources] = useState<DataSource[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);
    const [batchRecords, setBatchRecords] = useState<ImportRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        // Load data regardless of auth state for testing
        loadData();
    }, []);

    async function loadData() {
        const token = localStorage.getItem('accessToken');
        
        try {
            const [batchesRes, sourcesRes] = await Promise.all([
                fetch('/api/import/batches', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/import/sources', { headers: { Authorization: `Bearer ${token}` } })
            ]);

            const [batchesData, sourcesData] = await Promise.all([
                batchesRes.json(),
                sourcesRes.json()
            ]);

            if (batchesData.success) setBatches(batchesData.batches);
            if (sourcesData.success) setSources(sourcesData.sources);
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    }

    async function loadBatchDetails(batch: ImportBatch) {
        const token = localStorage.getItem('accessToken');
        
        try {
            const res = await fetch(`/api/import/batches/${batch.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setSelectedBatch(data.batch);
                setBatchRecords(data.records);
            }
        } catch (err) {
            console.error('Failed to load batch:', err);
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const token = localStorage.getItem('accessToken');
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/import/csv', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                alert(`Uploaded ${data.recordCount} records. Batch ID: ${data.batchId}`);
                loadData();
            } else {
                alert('Upload failed: ' + data.error);
            }
        } catch (err) {
            console.error('Upload failed:', err);
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    }

    async function detectDuplicates(batchId: number) {
        setProcessing(true);
        const token = localStorage.getItem('accessToken');

        try {
            const res = await fetch(`/api/import/batches/${batchId}/detect-duplicates`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await res.json();
            if (data.success) {
                alert(`Processed ${data.processed} records: ${data.matched} matched, ${data.new} new, ${data.needsReview} need review`);
                const batch = batches.find(b => b.id === batchId);
                if (batch) loadBatchDetails(batch);
            }
        } catch (err) {
            console.error('Detection failed:', err);
        } finally {
            setProcessing(false);
        }
    }

    async function importNewRecords(batchId: number) {
        setProcessing(true);
        const token = localStorage.getItem('accessToken');

        try {
            const res = await fetch(`/api/import/batches/${batchId}/import`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}` 
                }
            });

            const data = await res.json();
            if (data.success) {
                alert(`Imported ${data.imported} properties. ${data.errors} errors.`);
                loadData();
                setSelectedBatch(null);
            }
        } catch (err) {
            console.error('Import failed:', err);
        } finally {
            setProcessing(false);
        }
    }

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (user?.userType !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <p className="text-lg">Admin access required</p>
                <Link href="/">
                    <Button variant="outline">Return Home</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/admin">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-1" /> Admin
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold" data-testid="text-import-title">Data Import</h1>
                        <p className="text-muted-foreground">Import and manage property data from external sources</p>
                    </div>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" /> Upload CSV
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <label className="block cursor-pointer">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                disabled={uploading}
                                className="hidden"
                                data-testid="input-csv-upload"
                            />
                            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors">
                                {uploading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span>Uploading...</span>
                                    </div>
                                ) : (
                                    <>
                                        <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                        <p className="text-muted-foreground">Click or drag CSV file here</p>
                                        <p className="text-sm text-muted-foreground/70 mt-1">
                                            Expected columns: name, city, latitude, longitude, phone, email, website
                                        </p>
                                    </>
                                )}
                            </div>
                        </label>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Database className="h-5 w-5" /> Import Batches
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y">
                                    {batches.map(batch => (
                                        <div 
                                            key={batch.id} 
                                            className="p-4 cursor-pointer hover-elevate"
                                            onClick={() => loadBatchDetails(batch)}
                                            data-testid={`batch-row-${batch.id}`}
                                        >
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium truncate">{batch.batch_name}</p>
                                                    <p className="text-sm text-muted-foreground">{batch.source_name}</p>
                                                </div>
                                                {getStatusBadge(batch.status)}
                                            </div>
                                            <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <FileText className="h-3 w-3" /> {batch.total_records} records
                                                </span>
                                                <span className="flex items-center gap-1 text-green-500">
                                                    <CheckCircle className="h-3 w-3" /> {batch.imported_records} imported
                                                </span>
                                                {batch.error_records > 0 && (
                                                    <span className="flex items-center gap-1 text-destructive">
                                                        <AlertCircle className="h-3 w-3" /> {batch.error_records} errors
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {batches.length === 0 && (
                                        <div className="p-8 text-center text-muted-foreground">
                                            <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                            <p>No import batches yet. Upload a CSV to get started.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div>
                        <Card>
                            <CardHeader>
                                <CardTitle>Known Sources</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y">
                                    {sources.map(source => (
                                        <div key={source.id} className="p-3">
                                            <p className="font-medium text-sm">{source.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {source.source_type} - {source.update_frequency}
                                            </p>
                                            {source.last_imported_at && (
                                                <p className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-1">
                                                    <Clock className="h-3 w-3" />
                                                    Last: {new Date(source.last_imported_at).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Dialog open={!!selectedBatch} onOpenChange={() => setSelectedBatch(null)}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        {selectedBatch && (
                            <>
                                <DialogHeader>
                                    <DialogTitle>{selectedBatch.batch_name}</DialogTitle>
                                    <p className="text-sm text-muted-foreground">
                                        {selectedBatch.total_records} records - {selectedBatch.imported_records} imported
                                    </p>
                                </DialogHeader>

                                <div className="flex gap-2 py-2">
                                    <Button
                                        onClick={() => detectDuplicates(selectedBatch.id)}
                                        disabled={processing}
                                        variant="outline"
                                        data-testid="detect-duplicates"
                                    >
                                        {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                        Detect Duplicates
                                    </Button>
                                    <Button
                                        onClick={() => importNewRecords(selectedBatch.id)}
                                        disabled={processing}
                                        data-testid="import-records"
                                    >
                                        {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                        Import New Records
                                    </Button>
                                </div>

                                <div className="flex-1 overflow-y-auto border rounded">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted sticky top-0">
                                            <tr>
                                                <th className="text-left px-3 py-2 font-medium">Name</th>
                                                <th className="text-left px-3 py-2 font-medium">City</th>
                                                <th className="text-center px-3 py-2 font-medium">Status</th>
                                                <th className="text-center px-3 py-2 font-medium">Confidence</th>
                                                <th className="text-left px-3 py-2 font-medium">Notes</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {batchRecords.map(record => (
                                                <tr key={record.id}>
                                                    <td className="px-3 py-2">{record.name}</td>
                                                    <td className="px-3 py-2 text-muted-foreground">{record.city}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        {getStatusBadge(record.status)}
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-muted-foreground">
                                                        {record.confidence_score ? `${Number(record.confidence_score).toFixed(0)}%` : '-'}
                                                    </td>
                                                    <td className="px-3 py-2 text-muted-foreground text-xs">
                                                        {record.processing_notes}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
