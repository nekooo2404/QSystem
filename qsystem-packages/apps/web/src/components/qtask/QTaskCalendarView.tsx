'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
import './qtask.css';

const WEEK_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const EVENTS = [
  { title: 'Họp giao ban đầu tuần', time: '09:00', duration: '30 phút', color: 'blue' },
  { title: 'Rà soát thiết kế QHRM', time: '11:00', duration: '1 giờ', color: 'purple' },
  { title: 'Trình bày tiến độ QCRM', time: '14:00', duration: '2 giờ', color: 'green' },
  { title: 'Phiên review công việc', time: '16:30', duration: '45 phút', color: 'amber' },
];

export function QTaskCalendarView() {
  const today = new Date();
  const monthName = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(today);
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstDay + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  return (
    <section className="qx-page qtk-subpage" aria-label="QTask Calendar">
      <header className="qx-page-head qtk-dashboard__head">
        <div>
          <h1>Calendar</h1>
          <p>Theo dõi lịch họp, deadline và các mốc quan trọng của công việc.</p>
        </div>
        <div className="qx-actions">
          <button type="button" className="qx-btn qx-btn--primary">+ Thêm sự kiện</button>
        </div>
      </header>

      <div className="qtk-calendar-toolbar">
        <button type="button" className="qtk-round-button" aria-label="Tháng trước"><ChevronLeft size={16} /></button>
        <strong>{monthName}</strong>
        <button type="button" className="qtk-round-button" aria-label="Tháng sau"><ChevronRight size={16} /></button>
      </div>

      <div className="qtk-calendar-layout">
        <article className="qx-card qtk-dashboard-card qtk-calendar-card">
          <div className="qtk-calendar-week">
            {WEEK_DAYS.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="qtk-calendar-grid">
            {cells.map((day, index) => (
              <button
                type="button"
                key={`${day ?? 'empty'}-${index}`}
                className={`qtk-calendar-day${day === today.getDate() ? ' is-today' : ''}${day === null ? ' is-empty' : ''}`}
                disabled={day === null}
              >
                {day}
              </button>
            ))}
          </div>
        </article>

        <article className="qx-card qtk-dashboard-card qtk-events-card">
          <div className="qtk-overview-card__head">
            <div><h2>Today's Events</h2><p>Lịch làm việc trong ngày</p></div>
          </div>
          <div className="qtk-events-list">
            {EVENTS.map((event) => (
              <div className="qtk-event" key={event.title}>
                <span className={`qtk-event__bar qtk-event__bar--${event.color}`} />
                <div className="qtk-event__copy">
                  <strong>{event.title}</strong>
                  <small>{event.time}</small>
                  <span>{event.duration} <Video size={12} aria-hidden="true" /></span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
