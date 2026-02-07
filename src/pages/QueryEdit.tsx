import type { SqlQuery } from '@/lib/provider/types';
import {
  QueryEditDialogs,
  QueryEditFormCard,
  QueryEditLoadingState,
  QueryEditToolbar,
} from '@/pages/query-edit/QueryEditSections';
import { useQueryEditor } from '@/pages/query-edit/useQueryEditor';

const QueryEdit = () => {
  const {
    query,
    setQuery,
    isNewQuery,
    theme,
    folders,
    loadingFoldersForMove,
    sqlWarnings,
    saving,
    loadingQuery,
    isEditable,
    deleteDialogOpen,
    setDeleteDialogOpen,
    moveDialogOpen,
    setMoveDialogOpen,
    approvalDialogOpen,
    setApprovalDialogOpen,
    selectedFolderId,
    setSelectedFolderId,
    changeReason,
    setChangeReason,
    handleSave,
    handleCreateNewDraft,
    handleDiscardDraft,
    handleOpenMoveDialog,
    handleMove,
    navigate,
  } = useQueryEditor();

  if (loadingQuery) {
    return <QueryEditLoadingState />;
  }

  if (!query) {
    return null;
  }

  const editorTheme = theme === 'dark' ? 'vs-dark' : 'light';

  const handleQueryChange = (patch: Partial<SqlQuery>) => {
    setQuery((previous) => (previous ? { ...previous, ...patch } : previous));
  };

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <QueryEditToolbar
          isNewQuery={isNewQuery}
          onBack={() => navigate(`/folder/${query.folder_id}`)}
          onOpenMoveDialog={handleOpenMoveDialog}
          onOpenViewQuery={() => navigate(`/query/view/${query.id}`)}
        />

        <QueryEditFormCard
          query={query}
          isNewQuery={isNewQuery}
          isEditable={isEditable}
          saving={saving}
          sqlWarnings={sqlWarnings}
          editorTheme={editorTheme}
          onQueryChange={handleQueryChange}
          onSave={handleSave}
          onOpenApprovalDialog={() => setApprovalDialogOpen(true)}
          onOpenDeleteDialog={() => setDeleteDialogOpen(true)}
          onCreateNewDraft={handleCreateNewDraft}
        />
      </div>

      <QueryEditDialogs
        saving={saving}
        deleteDialogOpen={deleteDialogOpen}
        moveDialogOpen={moveDialogOpen}
        approvalDialogOpen={approvalDialogOpen}
        selectedFolderId={selectedFolderId}
        folders={folders}
        loadingFoldersForMove={loadingFoldersForMove}
        changeReason={changeReason}
        onDeleteDialogOpenChange={setDeleteDialogOpen}
        onDiscardDraft={handleDiscardDraft}
        onMoveDialogOpenChange={setMoveDialogOpen}
        onFolderSelect={setSelectedFolderId}
        onMove={handleMove}
        onApprovalDialogOpenChange={setApprovalDialogOpen}
        onChangeReason={setChangeReason}
        onCancelApproval={() => {
          setApprovalDialogOpen(false);
          setChangeReason('');
        }}
        onSubmitApproval={() => {
          setApprovalDialogOpen(false);
          void handleSave('pending_approval');
        }}
      />
    </main>
  );
};

export default QueryEdit;
