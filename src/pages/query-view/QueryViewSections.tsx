import Editor, { DiffEditor } from '@monaco-editor/react';
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Edit,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import type { QueryApproval, QueryHistory, SqlQuery } from '@/lib/provider/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface QueryViewActionBarProps {
  query: SqlQuery;
  updating: boolean;
  hasUserApproved: boolean;
  canApprove: boolean;
  canReject: boolean;
  canSubmitForApproval: boolean;
  canDelete: boolean;
  onBack: () => void;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  onOpenSubmitDialog: () => void;
  onOpenDeleteDialog: () => void;
}

interface QueryDetailsCardProps {
  query: SqlQuery;
  approvals: QueryApproval[];
  approvalQuota: number;
  copied: boolean;
  statusVariant: 'default' | 'secondary' | 'outline' | 'destructive';
  editorTheme: string;
  onCopySql: () => void;
}

interface QueryHistoryCardProps {
  loadingHistory: boolean;
  history: QueryHistory[];
  onHistoryClick: (record: QueryHistory, index: number) => void;
  formatDate: (dateString: string) => string;
}

interface QueryHistoryDialogProps {
  open: boolean;
  selectedHistory: QueryHistory | null;
  previousHistory: QueryHistory | null;
  editorTheme: string;
  canRevert: boolean;
  reverting: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenRevertDialog: () => void;
  onClose: () => void;
  formatDate: (dateString: string) => string;
}

interface QueryViewDialogsProps {
  revertDialogOpen: boolean;
  deleteDialogOpen: boolean;
  submitDialogOpen: boolean;
  selectedHistory: QueryHistory | null;
  reverting: boolean;
  submitting: boolean;
  changeReason: string;
  onRevertDialogOpenChange: (open: boolean) => void;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onSubmitDialogOpenChange: (open: boolean) => void;
  onRevert: () => void;
  onDelete: () => void;
  onSubmit: () => void;
  onChangeReason: (value: string) => void;
  formatDate: (dateString: string) => string;
}

export function QueryViewLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

export function QueryViewActionBar({
  query,
  updating,
  hasUserApproved,
  canApprove,
  canReject,
  canSubmitForApproval,
  canDelete,
  onBack,
  onApprove,
  onReject,
  onEdit,
  onOpenSubmitDialog,
  onOpenDeleteDialog,
}: QueryViewActionBarProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <Button variant="ghost" onClick={onBack} className="self-start">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Folder
      </Button>

      <div className="flex flex-wrap gap-2">
        {query.status === 'pending_approval' && (
          <>
            <Button onClick={onApprove} disabled={updating || !canApprove}>
              {updating ? 'Processing...' : hasUserApproved ? 'Already Approved' : 'Approve'}
            </Button>
            {canReject && (
              <Button onClick={onReject} disabled={updating} variant="outline">
                {updating ? 'Processing...' : 'Reject'}
              </Button>
            )}
          </>
        )}
        <Button onClick={onEdit}>
          <Edit className="mr-2 h-4 w-4" />
          Edit Query
        </Button>
        {canSubmitForApproval && (
          <Button onClick={onOpenSubmitDialog} variant="secondary">
            <Send className="mr-2 h-4 w-4" />
            Submit for Approval
          </Button>
        )}
        {canDelete && (
          <Button onClick={onOpenDeleteDialog} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Query
          </Button>
        )}
      </div>
    </div>
  );
}

export function QueryDetailsCard({
  query,
  approvals,
  approvalQuota,
  copied,
  statusVariant,
  editorTheme,
  onCopySql,
}: QueryDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <CardTitle className="break-words">{query.title}</CardTitle>
          <Badge variant={statusVariant}>
            {query.status === 'pending_approval'
              ? 'Pending Approval'
              : query.status.charAt(0).toUpperCase() + query.status.slice(1)}
          </Badge>
          {query.status === 'pending_approval' && (
            <Badge variant="outline">Approvals: {approvals.length} / {approvalQuota}</Badge>
          )}
        </div>
        {query.description && <CardDescription>{query.description}</CardDescription>}
        <div className="mt-4 space-y-1 text-sm">
          {query.created_by_email && (
            <p className="text-muted-foreground">Created by {query.created_by_email}</p>
          )}
          {query.last_modified_by_email && (
            <p className="text-muted-foreground">Last modified by {query.last_modified_by_email}</p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Label>SQL Content</Label>
            <Button variant="outline" size="sm" onClick={onCopySql} className="h-8">
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy SQL
                </>
              )}
            </Button>
          </div>
          <div className="overflow-hidden rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
            <Editor
              height="300px"
              defaultLanguage="sql"
              value={query.sql_content}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
              theme={editorTheme}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function QueryHistoryCard({
  loadingHistory,
  history,
  onHistoryClick,
  formatDate,
}: QueryHistoryCardProps) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Change History</CardTitle>
        <CardDescription>View all previous versions of this query</CardDescription>
      </CardHeader>
      <CardContent>
        {loadingHistory ? (
          <p className="text-muted-foreground">Loading history...</p>
        ) : history.length > 0 ? (
          <div className="space-y-3">
            {history.map((record, index) => (
              <button
                key={record.id}
                onClick={() => onHistoryClick(record, index)}
                className="flex w-full items-start justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{record.modified_by_email}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(record.created_at)}</p>
                  {record.change_reason && (
                    <p className="mt-1 text-xs italic text-muted-foreground">{record.change_reason}</p>
                  )}
                </div>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No change history yet</p>
        )}
      </CardContent>
    </Card>
  );
}

export function QueryHistoryDialog({
  open,
  selectedHistory,
  previousHistory,
  editorTheme,
  canRevert,
  reverting,
  onOpenChange,
  onOpenRevertDialog,
  onClose,
  formatDate,
}: QueryHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Query History Comparison</DialogTitle>
          <DialogDescription>Compare this historical version with the current query</DialogDescription>
        </DialogHeader>
        {selectedHistory && (
          <div className="space-y-4">
            <div className="text-sm">
              <p className="font-medium">Version Modified By:</p>
              <p className="text-muted-foreground">{selectedHistory.modified_by_email}</p>
              <p className="text-muted-foreground">{formatDate(selectedHistory.created_at)}</p>
              {selectedHistory.change_reason && (
                <div className="mt-2">
                  <p className="font-medium">Change Reason:</p>
                  <p className="italic text-muted-foreground">{selectedHistory.change_reason}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-muted-foreground">
                  {previousHistory
                    ? `Previous Version (${formatDate(previousHistory.created_at)})`
                    : 'No Previous Version'}
                </span>
                <span className="text-muted-foreground">{`Selected Version (${formatDate(selectedHistory.created_at)})`}</span>
              </div>
              <div className="overflow-hidden rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                <DiffEditor
                  height="500px"
                  language="sql"
                  original={previousHistory?.sql_content || ''}
                  modified={selectedHistory.sql_content}
                  theme={editorTheme}
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    wordWrap: 'on',
                    automaticLayout: true,
                    useInlineViewWhenSpaceIsLimited: false,
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={onOpenRevertDialog}
                variant="outline"
                disabled={!canRevert || reverting}
                className="flex-1"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Revert to this Version
              </Button>
              <Button onClick={onClose} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function QueryViewDialogs({
  revertDialogOpen,
  deleteDialogOpen,
  submitDialogOpen,
  selectedHistory,
  reverting,
  submitting,
  changeReason,
  onRevertDialogOpenChange,
  onDeleteDialogOpenChange,
  onSubmitDialogOpenChange,
  onRevert,
  onDelete,
  onSubmit,
  onChangeReason,
  formatDate,
}: QueryViewDialogsProps) {
  return (
    <>
      <AlertDialog open={revertDialogOpen} onOpenChange={onRevertDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert to Previous Version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the current SQL content with the version from{' '}
              <strong>{selectedHistory && formatDate(selectedHistory.created_at)}</strong> by{' '}
              <strong>{selectedHistory?.modified_by_email}</strong>.
              <br />
              <br />
              The query will be set to <strong>draft</strong> status and will need to go through
              the approval process again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reverting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRevert} disabled={reverting}>
              {reverting ? 'Reverting...' : 'Revert'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={onDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this query and its entire history? This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Query
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={submitDialogOpen} onOpenChange={onSubmitDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Query for Approval</AlertDialogTitle>
            <AlertDialogDescription>
              This will submit the current query for team approval. Optionally provide a reason for
              this submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="changeReason">Change Reason (optional)</Label>
            <Textarea
              id="changeReason"
              placeholder="Describe what changed or why this is being submitted..."
              value={changeReason}
              onChange={(event) => onChangeReason(event.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
