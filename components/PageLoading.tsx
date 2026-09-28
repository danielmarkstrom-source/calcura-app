export default function PageLoading() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[var(--paper)] p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--steel)]" />
    </div>
  );
}
