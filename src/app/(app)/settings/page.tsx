import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
    return (
        <div className="px-8 py-8 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Configure workspace defaults for upload and export workflows.
                </p>
            </div>

            <Card className="border-gray-200">
                <CardHeader>
                    <CardTitle className="text-base font-semibold text-gray-900">
                        Workspace defaults
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                        These values will pre-fill future import forms.
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="default-company">Default Tally company</Label>
                        <Input
                            id="default-company"
                            placeholder="e.g. Rajesh Kumar & Associates"
                            disabled
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="default-mode">Default accounting mode</Label>
                        <Input id="default-mode" value="investor" disabled />
                    </div>
                    <p className="text-xs text-gray-400">TODO: Persist settings to user profile storage.</p>
                </CardContent>
            </Card>

            <Card className="border-gray-200">
                <CardContent className="py-10">
                    <div className="text-center space-y-2">
                        <p className="text-sm font-medium text-gray-700">No connected integrations yet</p>
                        <p className="text-xs text-gray-400">
                            Supabase auth/profile and Tally connectivity options will be surfaced here.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}