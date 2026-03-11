import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AppBatchStatus } from "@/lib/types";

const STATUS_STYLES: Record<AppBatchStatus, string> = {
    queued: "bg-gray-100 text-gray-700 border-gray-200",
    running: "bg-indigo-100 text-indigo-700 border-indigo-200",
    succeeded: "bg-emerald-100 text-emerald-700 border-emerald-200",
    failed: "bg-red-100 text-red-700 border-red-200",
    needs_review: "bg-amber-100 text-amber-700 border-amber-200",
};

const STATUS_LABELS: Record<AppBatchStatus, string> = {
    queued: "Queued",
    running: "Running",
    succeeded: "Succeeded",
    failed: "Failed",
    needs_review: "Needs review",
};

export default function BatchesPage() {
    return (
        <div className="px-8 py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Batches</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Track upload and processing lifecycle for each import batch.
                    </p>
                </div>
                <Link
                    href="/upload"
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                >
                    New Import
                </Link>
            </div>

            <Card className="border-gray-200">
                <CardHeader>
                    <CardTitle className="text-base font-semibold text-gray-900">
                        Batch status taxonomy
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                        Shared terms used across app UI and API contracts.
                    </p>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    {(Object.keys(STATUS_LABELS) as AppBatchStatus[]).map((status) => (
                        <Badge key={status} className={`border ${STATUS_STYLES[status]}`}>
                            {STATUS_LABELS[status]}
                        </Badge>
                    ))}
                </CardContent>
            </Card>

            <Card className="border-gray-200">
                <CardContent className="py-16">
                    <div className="text-center space-y-2">
                        <p className="text-sm font-medium text-gray-700">No batches yet</p>
                        <p className="text-xs text-gray-400">
                            Once upload + process APIs are wired, persisted batch history will appear here.
                        </p>
                        <p className="text-xs text-gray-400">TODO: Bind this page to backend batch list API.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}