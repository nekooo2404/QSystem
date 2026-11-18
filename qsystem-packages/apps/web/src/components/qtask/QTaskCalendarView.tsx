'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { apiFetch } from '../../lib/api/client';
import { canUseDevPersistence, loadStoredCalendarEvents, saveStoredCalendarEvents } from './qtask.storage';
import './qtask.css';

const WEEK_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const TIME_SUGGESTIONS = ['08:00', '09:00', '10:00', '14:00', '16:00'];

interface CalendarEventItem {
  id: string;
  title: string;
  time: string;
  duration: string;
  color: string;
  day: number;
  month: number;
  year: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function QTaskCalendarView() {
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = React.useState(() => new Date().getDate());
  const [eventOpen, setEventOpen] = React.useState(false);
  const [eventTitle, setEventTitle] = React.useState('');
  const [eventTime, setEventTime] = React.useState('09:00');
  const [customEvents, setCustomEvents] = React.useState<CalendarEventItem[]>([]);
  const [deadlineEvents, setDeadlineEvents] = React.useState<CalendarEventItem[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(process.env.NODE_ENV !== 'test');
  React.useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 240);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (canUseDevPersistence()) setCustomEvents(loadStoredCalendarEvents());
    let active = true;
    apiFetch<Array<{ id: string; title: string; startsAt: string; color: string }>>('/api/org/events')
      .then((rows) => {
        if (!active || !Array.isArray(rows)) return;
        const remote = rows.map((row) => {
          const start = new Date(row.startsAt);
          return {
            id: row.id,
            title: row.title,
            time: `${pad2(start.getHours())}:${pad2(start.getMinutes())}`,
            duration: 'Sự kiện',
            color: row.color,
            day: start.getDate(),
            month: start.getMonth() + 1,
            year: start.getFullYear(),
          };
        });
        setCustomEvents((current) => {
          const stored = current.filter((item) => item.id.startsWith('evt-'));
          return [...stored, ...remote.filter((item) => !stored.some((local) => local.id === item.id))];
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    let active = true;
    apiFetch<{ items: { id: string; title: string; code: string; dueDate: string; status: string }[] }>('/api/org/tasks?pageSize=100', { useCache: true })
      .then((rows) => {
        if (!active || !Array.isArray(rows.items)) return;
        setDeadlineEvents(rows.items
          .filter((task) => task.status !== 'Hoàn thành')
          .map((task) => {
            const due = new Date(task.dueDate);
            return {
              id: `task-${task.id}`,
              title: `Hạn chót · ${task.title}`,
              time: due ? `${pad2(due.getHours())}:${pad2(due.getMinutes())}` : '23:59',
              duration: task.code,
              color: 'amber',
              day: due.getDate(),
              month: due.getMonth() + 1,
              year: due.getFullYear(),
            } satisfies CalendarEventItem;
          }));
        setLoadError(null);
      })
      .catch(() => {
        if (active) setLoadError('Không tải được deadline công việc từ máy chủ.');
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="qx-page qtk-subpage" aria-label="QTask Calendar" role="status" aria-busy="true">
        <div className="qtk-calendar-skeleton__head" />
        <div className="qtk-calendar-layout qtk-calendar-skeleton">
          <div className="qtk-calendar-skeleton__month" />
          <div className="qtk-calendar-skeleton__events">
            {Array.from({ length: 4 }, (_, index) => <div key={index} />)}
          </div>
        </div>
      </section>
    );
  }

  const today = new Date();
  const isCurrentMonth =
    visibleMonth.getFullYear() === today.getFullYear() && visibleMonth.getMonth() === today.getMonth();
  const monthName = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(visibleMonth);
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstDay + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const events = [...deadlineEvents, ...customEvents]
    .filter((event) => event.year === visibleMonth.getFullYear() && event.month === visibleMonth.getMonth() + 1)
    .filter((event) => event.day === selectedDay)
    .sort((a, b) => a.time.localeCompare(b.time));
  const daysWithEvents = new Set(
    [...deadlineEvents, ...customEvents]
      .filter((event) => event.year === visibleMonth.getFullYear() && event.month === visibleMonth.getMonth() + 1)
      .map((event) => event.day),
  );

  function removeEvent(eventId: string) {
    if (canUseDevPersistence()) {
      setCustomEvents((current) => {
        const updated = current.filter((item) => item.id !== eventId);
        saveStoredCalendarEvents(updated);
        return updated;
      });
      return;
    }
    setCustomEvents((current) => current.filter((item) => item.id !== eventId));
    void apiFetch(`/api/org/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' }).catch(() => {
      setLoadError('Không kết nối được máy chủ. Sự kiện chưa được xóa.');
    });
  }

  function shiftMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    setSelectedDay(1);
  }

  function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = eventTitle.trim();
    if (!title) return;
    const next: CalendarEventItem = {
      id: `evt-${Date.now()}`,
      title,
      time: eventTime,
      duration: '30 phút',
      color: 'blue',
      day: selectedDay,
      month: visibleMonth.getMonth() + 1,
      year: visibleMonth.getFullYear(),
    };
    if (!canUseDevPersistence()) {
      void apiFetch('/api/org/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: next.title,
          startsAt: `${next.year}-${pad2(next.month)}-${pad2(next.day)}T${next.time}:00`,
          color: next.color,
        }),
      }).then(() => {
        return apiFetch<Array<{ id: string; title: string; startsAt: string; color: string }>>('/api/org/events');
      }).then((rows) => {
        if (!Array.isArray(rows)) return;
        const remote = rows.map((row) => {
          const start = new Date(row.startsAt);
          return {
            id: row.id,
            title: row.title,
            time: `${pad2(start.getHours())}:${pad2(start.getMinutes())}`,
            duration: 'Sự kiện',
            color: row.color,
            day: start.getDate(),
            month: start.getMonth() + 1,
            year: start.getFullYear(),
          } satisfies CalendarEventItem;
        });
        setCustomEvents((current) => {
          const stored = current.filter((item) => item.id.startsWith('evt-'));
          return [...stored, ...remote];
        });
      }).catch(() => setLoadError('Không kết nối được máy chủ. Sự kiện chưa được lưu.'));
    } else {
      setCustomEvents((current) => {
        const updated = [...current, next];
        saveStoredCalendarEvents(updated);
        return updated;
      });
    }
    setEventTitle('');
    setEventOpen(false);
  }

  return (
    <section className="qx-page qtk-subpage" aria-label="QTask Calendar">
      <header className="qx-page-head qtk-dashboard__head">
        <div>
          <h1>Calendar</h1>
          <p>Theo dõi lịch họp, deadline và các mốc quan trọng của công việc.</p>
        </div>
        <div className="qx-actions">
          <button type="button" className="qx-btn qx-btn--primary" onClick={() => setEventOpen(true)}>
            + Thêm sự kiện
          </button>
        </div>
      </header>

      <div className="qtk-calendar-toolbar">
        <button type="button" className="qtk-round-button" aria-label="Tháng trước" onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></button>
        <strong>{monthName}</strong>
        <button type="button" className="qtk-round-button" aria-label="Tháng sau" onClick={() => shiftMonth(1)}><ChevronRight size={16} /></button>
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
                className={`qtk-calendar-day${isCurrentMonth && day === today.getDate() ? ' is-today' : ''}${day === selectedDay ? ' is-selected' : ''}${day === null ? ' is-empty' : ''}${day !== null && daysWithEvents.has(day) ? ' has-events' : ''}`}
                disabled={day === null}
                aria-pressed={day === selectedDay}
                onClick={() => day && setSelectedDay(day)}
              >
                {day}
                {day !== null && daysWithEvents.has(day) ? <i className="qtk-calendar-day-dot" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
          <div className="qtk-calendar-legend">
            <span><i className="qtk-calendar-dot is-today" /> Hôm nay</span>
            <span><i className="qtk-calendar-dot is-event" /> Có sự kiện / hạn chót</span>
          </div>
        </article>

        <article className="qx-card qtk-dashboard-card qtk-events-card">
          <div className="qtk-overview-card__head">
            <div><h2>Today's Events</h2><p>Lịch làm việc trong ngày</p></div>
          </div>
          <div className="qtk-events-list">
            {events.map((event) => (
              <div className="qtk-event" key={event.title}>
                <span className={`qtk-event__bar qtk-event__bar--${event.color}`} />
                <div className="qtk-event__copy">
                  <strong>{event.title}</strong>
                  <small>{`${event.day}/${event.month}`}</small>
                  <small>{event.time}</small>
                  <span>{event.duration} <Video size={12} aria-hidden="true" /></span>
                </div>
                {event.id.startsWith('evt-') ? (
                  <button
                    type="button"
                    className="qtk-modal__close"
                    aria-label={`Xóa sự kiện ${event.title}`}
                    onClick={() => removeEvent(event.id)}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
            {events.length === 0 ? <p className="qtk-overview-empty">Không có sự kiện trong ngày đã chọn</p> : null}
          </div>
          {loadError ? <p style={{ margin: '10px 0 0', color: 'var(--qs-fg-muted)', fontSize: 12 }}>{loadError}</p> : null}
        </article>
      </div>

      {eventOpen ? (
        <div className="qtk-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEventOpen(false)}>
          <form className="qtk-modal qtk-calendar-event-modal" role="dialog" aria-modal="true" aria-labelledby="qtk-event-title" onSubmit={createEvent}>
            <div className="qtk-modal__head">
              <h2 id="qtk-event-title">Thêm sự kiện</h2>
              <p>Ngày {selectedDay}/{visibleMonth.getMonth() + 1}/{visibleMonth.getFullYear()}</p>
            </div>
            <div className="qtk-modal__body">
              <div className="qtk-field qtk-field--full">
                <label className="qtk-field__label" htmlFor="qtk-event-name">Tên sự kiện</label>
                <input id="qtk-event-name" className="qtk-input" autoFocus value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} />
              </div>
              <div className="qtk-field qtk-field--full">
                <label className="qtk-field__label" htmlFor="qtk-event-time">Thời gian</label>
                <select id="qtk-event-time" className="qtk-input" value={eventTime} onChange={(event) => setEventTime(event.target.value)}>
                  {TIME_SUGGESTIONS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                </select>
              </div>
            </div>
            <div className="qtk-modal__foot">
              <button type="button" className="qx-btn" onClick={() => setEventOpen(false)}>Hủy</button>
              <button type="submit" className="qx-btn qx-btn--primary">Thêm sự kiện</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
