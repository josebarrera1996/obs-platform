"use client";

import { useEffect, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useSettingsStore } from "@/store/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Cloud,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Key,
  Globe,
  Tag,
  Bell,
  MessageSquare,
  Shield,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";

function CredentialStatusBadge({ status }: { status: string }) {
  if (status === "valid")
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Valid
      </Badge>
    );
  if (status === "invalid")
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
        <XCircle className="mr-1 h-3 w-3" /> Invalid
      </Badge>
    );
  return (
    <Badge variant="outline" className="bg-muted text-muted-foreground">
      Untested
    </Badge>
  );
}

function AddCredentialDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addCredential, testNewCredentials } = useSettingsStore();
  const [alias, setAlias] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    accountId?: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const handleTest = async () => {
    if (!accessKeyId || !secretAccessKey) return;
    setIsTesting(true);
    setTestResult(null);
    const result = await testNewCredentials(accessKeyId, secretAccessKey, region);
    setTestResult(result);
    setIsTesting(false);
  };

  const handleSave = async () => {
    if (!alias || !accessKeyId || !secretAccessKey || !region) return;
    setIsSaving(true);
    const success = await addCredential(alias, accessKeyId, secretAccessKey, region);
    setIsSaving(false);
    if (success) {
      setAlias("");
      setAccessKeyId("");
      setSecretAccessKey("");
      setRegion("us-east-1");
      setTestResult(null);
      onOpenChange(false);
    }
  };

  const isValid = alias && accessKeyId && secretAccessKey && region;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Add AWS Credentials
          </DialogTitle>
          <DialogDescription>
            Configure AWS IAM credentials to connect your AWS account. Use an IAM user with
            CloudWatch, EC2, and CloudTrail read permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Alias */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              Account Alias
            </label>
            <Input
              placeholder="e.g. Production AWS, Dev Account..."
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </div>

          {/* Access Key ID */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Access Key ID
            </label>
            <Input
              placeholder="AKIAIOSFODNN7EXAMPLE"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
            />
          </div>

          {/* Secret Access Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              Secret Access Key
            </label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your secret key is encrypted at rest and never sent to the frontend.
            </p>
          </div>

          {/* Region */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Default Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="us-east-1">US East (N. Virginia) — us-east-1</option>
              <option value="us-east-2">US East (Ohio) — us-east-2</option>
              <option value="us-west-1">US West (N. California) — us-west-1</option>
              <option value="us-west-2">US West (Oregon) — us-west-2</option>
              <option value="eu-west-1">EU (Ireland) — eu-west-1</option>
              <option value="eu-central-1">EU (Frankfurt) — eu-central-1</option>
              <option value="eu-west-2">EU (London) — eu-west-2</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore) — ap-southeast-1</option>
              <option value="ap-southeast-2">Asia Pacific (Sydney) — ap-southeast-2</option>
              <option value="ap-northeast-1">Asia Pacific (Tokyo) — ap-northeast-1</option>
              <option value="sa-east-1">South America (São Paulo) — sa-east-1</option>
            </select>
          </div>

          {/* Test result */}
          {testResult && (
            <div
              className={`rounded-md p-3 text-sm ${
                testResult.valid
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-600 border border-red-500/20"
              }`}
            >
              {testResult.valid ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    Connected successfully! AWS Account ID:{" "}
                    <code className="font-mono text-xs">{testResult.accountId}</code>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Connection failed. Check your credentials and permissions.</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleTest} disabled={!accessKeyId || !secretAccessKey || isTesting}>
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
          <Button onClick={handleSave} disabled={!isValid || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Credentials"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredentialCard({
  cred,
  onTest,
  onDelete,
  isTesting,
}: {
  cred: {
    id: string;
    alias: string;
    maskedKey: string;
    region: string;
    status: string;
    createdAt: string;
    lastTestedAt?: string;
  };
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
  isTesting: boolean;
}) {
  return (
    <Card className="group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Cloud className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{cred.alias}</h3>
                <CredentialStatusBadge status={cred.status} />
              </div>
              <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                <p>Key: {cred.maskedKey}</p>
                <p>Region: {cred.region}</p>
                <p>
                  Added: {new Date(cred.createdAt).toLocaleDateString()}
                  {cred.lastTestedAt &&
                    ` · Last tested: ${new Date(cred.lastTestedAt).toLocaleDateString()}`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTest(cred.id)}
              disabled={isTesting}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Test</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(cred.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Delete</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const {
    credentials,
    fetchCredentials,
    deleteCredential,
    testCredential,
    isTesting,
    isLoading,
    activeCredentialId,
    setActiveCredential,
  } = useSettingsStore();

  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Slack integration
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackStatus, setSlackStatus] = useState<{ ok: boolean; message: string } | null>(null);

  // Alert rules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [alertRules, setAlertRules] = useState<any[]>([]);
  const [newRule, setNewRule] = useState({
    name: "",
    metric: "CPUUtilization",
    operator: "gt" as "gt" | "lt",
    threshold: 80,
  });

  const testSlack = async () => {
    const url = slackWebhookUrl || process.env.NEXT_PUBLIC_SLACK_WEBHOOK_URL;
    if (!url) {
      setSlackStatus({ ok: false, message: "Enter a Slack webhook URL first" });
      return;
    }
    setSlackTesting(true);
    setSlackStatus(null);
    try {
      const res = await fetch("/api/alerts/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", webhookUrl: url }),
      });
      const data = await res.json();
      setSlackStatus({
        ok: data.ok,
        message: data.ok ? "Test message sent to Slack!" : data.error,
      });
    } catch {
      setSlackStatus({ ok: false, message: "Failed to send test message" });
    } finally {
      setSlackTesting(false);
    }
  };

  const createRule = async () => {
    try {
      const res = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          rule: {
            ...newRule,
            namespace: "AWS/ECS",
            stat: "Average",
            severity: "warning",
            cooldownMinutes: 10,
            enabled: true,
            channels: ["slack"],
            description: `Alert when ${newRule.metric} ${newRule.operator} ${newRule.threshold}`,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAlertRules((prev) => [...prev, data.rule]);
        setNewRule({ name: "", metric: "CPUUtilization", operator: "gt", threshold: 80 });
      }
    } catch {
      // ignore
    }
  };

  const toggleRule = async (ruleId: string) => {
    const rule = alertRules.find((r) => r.id === ruleId);
    if (!rule) return;
    try {
      const res = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          ruleId,
          updates: { enabled: !rule.enabled },
        }),
      });
      if (res.ok) {
        setAlertRules((prev) =>
          prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
        );
      }
    } catch {
      // ignore
    }
  };

  const deleteAlertRule = async (ruleId: string) => {
    try {
      const res = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ruleId }),
      });
      if (res.ok) {
        setAlertRules((prev) => prev.filter((r) => r.id !== ruleId));
      }
    } catch {
      // ignore
    }
  };

  // Load alert rules on mount
  useEffect(() => {
    fetch("/api/alerts/rules")
      .then((res) => res.json())
      .then((data) => setAlertRules(data.rules || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  return (
    <MainLayout>
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your AWS account connections and platform configuration.
            </p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add AWS Account
          </Button>
        </div>

        {/* Connected accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cloud className="h-5 w-5" />
              AWS Accounts
            </CardTitle>
            <CardDescription>
              Configure AWS IAM credentials to connect your accounts. Credentials are stored
              locally and used server-side to fetch metrics via CloudWatch, EC2, and CloudTrail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && credentials.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : credentials.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <Cloud className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-medium">No AWS accounts connected</h3>
                <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
                  Add your first AWS account to start monitoring your infrastructure in real time.
                  You&apos;ll need an IAM user with CloudWatch, EC2, and CloudTrail read access.
                </p>
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add AWS Account
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Active credential selector */}
                <div className="mb-4 flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                  <span className="text-sm font-medium">Active account:</span>
                  <select
                    value={activeCredentialId || ""}
                    onChange={(e) =>
                      setActiveCredential(e.target.value || null)
                    }
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="">Use mock data</option>
                    {credentials.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.alias} ({c.maskedKey})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Select which account the dashboard will use.
                  </p>
                </div>

                {credentials.map((cred) => (
                  <CredentialCard
                    key={cred.id}
                    cred={cred}
                    onTest={testCredential}
                    onDelete={deleteCredential}
                    isTesting={isTesting === cred.id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* IAM permissions info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Required IAM Permissions
            </CardTitle>
            <CardDescription>
              The IAM user needs the following permissions for full observability:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-muted/50 p-3">
              <pre className="text-xs leading-relaxed text-muted-foreground">
{`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sts:GetCallerIdentity",
        "cloudwatch:ListMetrics",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:GetMetricData",
        "ec2:DescribeInstances",
        "ec2:DescribeTags",
        "cloudtrail:LookupEvents"
      ],
      "Resource": "*"
    }
  ]
}`}
              </pre>
            </div>
            <p className="text-xs text-muted-foreground">
              These permissions grant read-only access. Your credentials are stored locally and
              never shared with third parties.
            </p>
          </CardContent>
        </Card>
      </div>

      <AddCredentialDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      {/* ── Slack Integration ── */}
      <h2 className="text-lg font-semibold mt-8 mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        Slack Integration
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Slack Webhook</CardTitle>
          <CardDescription className="text-xs">
            Configure a Slack webhook URL to receive alert notifications. 
            Create one at https://api.slack.com/messaging/webhooks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="https://hooks.slack.com/services/..."
              value={slackWebhookUrl}
              onChange={(e) => setSlackWebhookUrl(e.target.value)}
              className="flex-1 font-mono text-xs"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={testSlack}
              disabled={slackTesting}
            >
              {slackTesting ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <MessageSquare className="h-3 w-3 mr-1" />
              )}
              Test
            </Button>
          </div>
          {slackStatus && (
            <div className={`flex items-center gap-2 text-xs ${
              slackStatus.ok ? "text-emerald-600" : "text-red-500"
            }`}>
              {slackStatus.ok ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {slackStatus.message}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            The webhook URL is stored in your browser and sent to the server when sending alerts.
            It is never stored on disk.
          </p>
        </CardContent>
      </Card>

      {/* ── Alert Rules ── */}
      <h2 className="text-lg font-semibold mt-8 mb-4 flex items-center gap-2">
        <Bell className="h-5 w-5" />
        Alert Rules
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Alert Thresholds</CardTitle>
          <CardDescription className="text-xs">
            Configure thresholds for automatic alerts. When a metric exceeds the threshold,
            a notification is sent via Slack.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alertRules.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p>No alert rules configured yet.</p>
              <p className="text-xs mt-1">Add your first alert rule below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alertRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{rule.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${
                        rule.severity === "critical"
                          ? "border-red-200 text-red-600"
                          : "border-amber-200 text-amber-600"
                      }`}>
                        {rule.severity}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${
                        rule.enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-gray-500/10 text-gray-500"
                      }`}>
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {rule.namespace} / {rule.metric} {rule.operator} {rule.threshold}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggleRule(rule.id)}
                    >
                      {rule.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-red-500 hover:text-red-600"
                      onClick={() => deleteAlertRule(rule.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border/20">
            <p className="text-xs font-medium mb-2">Add new rule</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Input
                placeholder="Rule name"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="text-xs h-8"
              />
              <select
                value={newRule.metric}
                onChange={(e) => setNewRule({ ...newRule, metric: e.target.value })}
                className="text-xs h-8 rounded-lg border border-input bg-transparent px-2"
              >
                <option value="CPUUtilization">CPU</option>
                <option value="MemoryUtilization">Memory</option>
              </select>
              <select
                value={`${newRule.operator}|${newRule.threshold}`}
                onChange={(e) => {
                  const [op, threshold] = e.target.value.split("|");
                  setNewRule({ ...newRule, operator: op as "gt" | "lt", threshold: Number(threshold) });
                }}
                className="text-xs h-8 rounded-lg border border-input bg-transparent px-2"
              >
                <option value="gt|80">&gt; 80%</option>
                <option value="gt|90">&gt; 90%</option>
                <option value="gt|95">&gt; 95%</option>
                <option value="lt|10">&lt; 10%</option>
              </select>
              <Button
                variant="default"
                size="sm"
                className="h-8 text-xs"
                onClick={createRule}
                disabled={!newRule.name}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Rule
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddCredentialDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </MainLayout>
  );
}
