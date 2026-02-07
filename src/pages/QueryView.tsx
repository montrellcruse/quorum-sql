import {
  QueryDetailsCard,
  QueryHistoryCard,
  QueryHistoryDialog,
  QueryViewActionBar,
  QueryViewDialogs,
  QueryViewLoadingState,
} from '@/pages/query-view/QueryViewSections';
import { useQueryView } from '@/pages/query-view/useQueryView';

const QueryView = () => {
  const {
    query,
    history,
    selectedHistory,
    previousHistory,
    approvals,
    approvalQuota,
    hasUserApproved,
    loadingQuery,
    loadingHistory,
    updating,
    copied,
    revertDialogOpen,
    deleteDialogOpen,
    submitDialogOpen,
    historyModalOpen,
    reverting,
    submitting,
    changeReason,
    canRevert,
    canApprove,
    canReject,
    canSubmitForApproval,
    getStatusVariant,
    formatDate,
    setHistoryModalOpen,
    setRevertDialogOpen,
    setDeleteDialogOpen,
    setSubmitDialogOpen,
    setChangeReason,
    handleHistoryClick,
    handleApprove,
    handleReject,
    handleDeleteQuery,
    handleCopySql,
    handleRevert,
    canDeleteQuery,
    handleSubmitForApproval,
    navigate,
    theme,
  } = useQueryView();

  if (loadingQuery) {
    return <QueryViewLoadingState />;
  }

  if (!query) {
    return null;
  }

  const editorTheme = theme === 'dark' ? 'vs-dark' : 'light';

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <QueryViewActionBar
          query={query}
          updating={updating}
          hasUserApproved={hasUserApproved}
          canApprove={Boolean(canApprove)}
          canReject={Boolean(canReject)}
          canSubmitForApproval={Boolean(canSubmitForApproval)}
          canDelete={canDeleteQuery()}
          onBack={() => navigate(`/folder/${query.folder_id}`)}
          onApprove={handleApprove}
          onReject={handleReject}
          onEdit={() => navigate(`/query/edit/${query.id}`)}
          onOpenSubmitDialog={() => setSubmitDialogOpen(true)}
          onOpenDeleteDialog={() => setDeleteDialogOpen(true)}
        />

        <QueryDetailsCard
          query={query}
          approvals={approvals}
          approvalQuota={approvalQuota}
          copied={copied}
          statusVariant={getStatusVariant(query.status)}
          editorTheme={editorTheme}
          onCopySql={handleCopySql}
        />

        <QueryHistoryCard
          loadingHistory={loadingHistory}
          history={history}
          onHistoryClick={handleHistoryClick}
          formatDate={formatDate}
        />

        <QueryHistoryDialog
          open={historyModalOpen}
          selectedHistory={selectedHistory}
          previousHistory={previousHistory}
          editorTheme={editorTheme}
          canRevert={Boolean(canRevert)}
          reverting={reverting}
          onOpenChange={setHistoryModalOpen}
          onOpenRevertDialog={() => setRevertDialogOpen(true)}
          onClose={() => setHistoryModalOpen(false)}
          formatDate={formatDate}
        />

        <QueryViewDialogs
          revertDialogOpen={revertDialogOpen}
          deleteDialogOpen={deleteDialogOpen}
          submitDialogOpen={submitDialogOpen}
          selectedHistory={selectedHistory}
          reverting={reverting}
          submitting={submitting}
          changeReason={changeReason}
          onRevertDialogOpenChange={setRevertDialogOpen}
          onDeleteDialogOpenChange={setDeleteDialogOpen}
          onSubmitDialogOpenChange={setSubmitDialogOpen}
          onRevert={handleRevert}
          onDelete={handleDeleteQuery}
          onSubmit={handleSubmitForApproval}
          onChangeReason={setChangeReason}
          formatDate={formatDate}
        />
      </div>
    </main>
  );
};

export default QueryView;
