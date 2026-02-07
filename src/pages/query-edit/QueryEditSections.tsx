import Editor from '@monaco-editor/react';
import { ArrowLeft, AlertTriangle, FolderInput, Save, Trash2 } from 'lucide-react';
import type { QueryStatus, SqlQuery, FolderPath } from '@/lib/provider/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface QueryEditToolbarProps {
  isNewQuery: boolean;
  onBack: () => void;
  onOpenMoveDialog: () => void;
  onOpenViewQuery: () => void;
}

interface QueryEditFormCardProps {
  query: SqlQuery;
  isNewQuery: boolean;
  isEditable: boolean;
  saving: boolean;
  sqlWarnings: string[];
  editorTheme: string;
  onQueryChange: (patch: Partial<SqlQuery>) => void;
  onSave: (status: QueryStatus) => void;
  onOpenApprovalDialog: () => void;
  onOpenDeleteDialog: () => void;
  onCreateNewDraft: () => void;
}

interface QueryEditDialogsProps {
  saving: boolean;
  deleteDialogOpen: boolean;
  moveDialogOpen: boolean;
  approvalDialogOpen: boolean;
  selectedFolderId: string;
  folders: FolderPath[];
  loadingFoldersForMove: boolean;
  changeReason: string;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onDiscardDraft: () => void;
  onMoveDialogOpenChange: (open: boolean) => void;
  onFolderSelect: (folderId: string) => void;
  onMove: () => void;
  onApprovalDialogOpenChange: (open: boolean) => void;
  onChangeReason: (value: string) => void;
  onCancelApproval: () => void;
  onSubmitApproval: () => void;
}

export function QueryEditLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

export function QueryEditToolbar({
  isNewQuery,
  onBack,
  onOpenMoveDialog,
  onOpenViewQuery,
}: QueryEditToolbarProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Folder
      </Button>

      <div className="flex flex-wrap gap-2">
        {!isNewQuery && (
          <>
            <Button variant="outline" onClick={onOpenMoveDialog}>
              <FolderInput className="mr-2 h-4 w-4" />
              Move
            </Button>
            <Button variant="outline" onClick={onOpenViewQuery}>
              View Query
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function QueryEditFormCard({
  query,
  isNewQuery,
  isEditable,
  saving,
  sqlWarnings,
  editorTheme,
  onQueryChange,
  onSave,
  onOpenApprovalDialog,
  onOpenDeleteDialog,
  onCreateNewDraft,
}: QueryEditFormCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{isNewQuery ? 'New Query' : 'Edit Query'}</CardTitle>
        <CardDescription>
          {isNewQuery
            ? 'Create a new SQL query'
            : query.status === 'pending_approval'
              ? 'Editing query (currently pending approval)'
              : query.status === 'approved'
                ? 'Editing approved query (will create new version)'
                : 'Edit SQL query'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={query.title}
            onChange={(event) => onQueryChange({ title: event.target.value })}
            placeholder="Enter query title"
            disabled={!isEditable}
            maxLength={200}
            className={!isEditable ? 'cursor-not-allowed opacity-60' : ''}
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={query.description || ''}
            onChange={(event) => onQueryChange({ description: event.target.value })}
            placeholder="Enter query description"
            rows={3}
            disabled={!isEditable}
            maxLength={1000}
            className={!isEditable ? 'cursor-not-allowed opacity-60' : ''}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label htmlFor="sql_content">SQL Content</Label>
            {!isEditable && (
              <span className="text-xs text-muted-foreground">
                Read-only. Click "Create New Draft" to edit.
              </span>
            )}
          </div>
          <div
            className={`overflow-hidden rounded-md border ${
              !isEditable
                ? 'border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800'
                : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'
            }`}
          >
            <Editor
              height="300px"
              defaultLanguage="sql"
              value={query.sql_content}
              onChange={(value) => onQueryChange({ sql_content: value || '' })}
              options={{
                readOnly: !isEditable,
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
              theme={editorTheme}
            />
          </div>

          {sqlWarnings.length > 0 && (
            <Alert variant="destructive" className="mt-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>SQL Safety Warning</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-semibold">
                    This query contains potentially dangerous operations:
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {sqlWarnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm italic">
                    ⚠️ Note: SQL queries are stored for reference only and not executed by this
                    application. Review carefully before running them manually in your database.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {query.status === 'draft' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button onClick={() => onSave('draft')} disabled={saving} variant="outline" className="flex-1">
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button onClick={onOpenApprovalDialog} disabled={saving} className="flex-1">
                Request Approval
              </Button>
            </div>
            {!isNewQuery && (
              <Button
                onClick={onOpenDeleteDialog}
                disabled={saving}
                variant="destructive"
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Discard Draft
              </Button>
            )}
          </div>
        )}

        {query.status === 'pending_approval' && (
          <div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
            This query is pending approval. Approval actions are available on the View page.
          </div>
        )}

        {query.status === 'approved' && (
          <Button onClick={onCreateNewDraft} disabled={saving} className="w-full">
            {saving ? 'Processing...' : 'Create New Draft'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function QueryEditDialogs({
  saving,
  deleteDialogOpen,
  moveDialogOpen,
  approvalDialogOpen,
  selectedFolderId,
  folders,
  loadingFoldersForMove,
  changeReason,
  onDeleteDialogOpenChange,
  onDiscardDraft,
  onMoveDialogOpenChange,
  onFolderSelect,
  onMove,
  onApprovalDialogOpenChange,
  onChangeReason,
  onCancelApproval,
  onSubmitApproval,
}: QueryEditDialogsProps) {
  return (
    <>
      <AlertDialog open={deleteDialogOpen} onOpenChange={onDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Draft</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to discard this draft? All changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDiscardDraft}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? 'Discarding...' : 'Discard'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={moveDialogOpen} onOpenChange={onMoveDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Query to Folder</DialogTitle>
            <DialogDescription>Select the folder where you want to move this query</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="folder-select">Select Folder</Label>
            <Select value={selectedFolderId} onValueChange={onFolderSelect}>
              <SelectTrigger id="folder-select" className="mt-2 bg-background">
                <SelectValue placeholder="Select a folder" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                {loadingFoldersForMove && (
                  <SelectItem value="__loading" disabled>
                    Loading folders...
                  </SelectItem>
                )}
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.full_path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onMoveDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onMove} disabled={saving}>
              {saving ? 'Moving...' : 'Confirm Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approvalDialogOpen} onOpenChange={onApprovalDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Approval</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for this change before submitting for approval
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="change-reason">Change Reason (Optional)</Label>
            <Textarea
              id="change-reason"
              placeholder="Explain what changed and why..."
              value={changeReason}
              onChange={(event) => onChangeReason(event.target.value)}
              className="mt-2 min-h-[100px]"
              maxLength={1000}
            />
            <p className="mt-1 text-xs text-muted-foreground">{changeReason.length}/1000 characters</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCancelApproval} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={onSubmitApproval} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
