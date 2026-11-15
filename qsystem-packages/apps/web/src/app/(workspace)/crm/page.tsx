import { EmptyState } from '@qsystem/ui';

export default function Page() {
  return (
    <section className="qs-page" aria-label="QCRM">
      <h1>QCRM</h1>
      <EmptyState
        title="QCRM chưa có tính năng nào"
        description="Phân hệ quản lý khách hàng đang được xây dựng. Hiện chưa có dữ liệu khách hàng để hiển thị."
      />
    </section>
  );
}
