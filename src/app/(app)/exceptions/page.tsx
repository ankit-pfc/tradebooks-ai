import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppExceptionSeverity } from "@/lib/types";

const SEVERITY_STYLES: Record<AppExceptionSeverity, string> = {
    error: "bg-red-100 text-red-700 border-red-200",
    warning: "bg-amber-100 text-amber-700 border-amber-200",
    info: "bg-blue-100 text-blue-700 border-blue-200",
};

const SEVERITY_LABELS: Record<AppExceptionSeverity, string> = {
    error: "Error",
    warning: "Warning",
    info: "Info",
};

export default function ExceptionsPage() {
    return (
        <div className="px-8 py-8 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-gray-900">Exceptions</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Review validation and reconciliation issues detected during processing.
                </p>
            </div>

            <Card className="border-gray-200">
                <CardHeader>
                    <CardTitle className="text-base font-semibold text-gray-900">
                        Exception severity taxonomy
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                        Shared severity terms used by backend checks and UI rendering.
                    </p>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    {(Object.keys(SEVERITY_LABELS) as AppExceptionSeverity[]).map((severity) => (
                        <Badge key={severity} className={`border ${SEVERITY_STYLES[severity]}`}>
                            {SEVERITY_LABELS[severity]}
                        </Badge>
                    ))}
                </CardContent>
            </Card>

            <Card className="border-gray-200">
                <CardContent className="py-16">
                    <div className="text-center space-y-2">
                        <p className="text-sm font-medium text-gray-700">No exceptions to review</p>
                        <p className="text-xs text-gray-400">
                            Exceptions from processed batches will be listed here.
                        </p>
                        <p className="text-xs text-gray-400">TODO: Bind this page to persisted exception records.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}