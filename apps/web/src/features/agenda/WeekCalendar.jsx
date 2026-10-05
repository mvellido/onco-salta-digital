import { useEffect, useState } from 'react';
import { KINDS, STATUSES, dayLabel, endTime, isoWeekday, layoutLanes, toMinutes, todayIso } from './agendaUtils';

const HOUR_PX = 56;

function nowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export default function WeekCalendar({
  days,
  appointments,
  schedules = [],
  startHour = 7,
  endHour = 20,
  showProfessional = false,
  onSlotClick,
  onAppointmentClick,
}) {
  const [now, setNow] = useState(nowMinutes);
  const today = todayIso();
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const height = (endHour - startHour) * HOUR_PX;
  const y = (minutes) => ((minutes - startHour * 60) / 60) * HOUR_PX;

  useEffect(() => {
    const timer = setInterval(() => setNow(nowMinutes()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleColumnClick = (event, date) => {
    if (!onSlotClick || event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = startHour * 60 + Math.floor(((event.clientY - rect.top) / HOUR_PX) * 2) * 30;
    onSlotClick(date, `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
  };

  return (
    <div className="calendar" style={{ '--cal-days': days.length }}>
      <div className="calendar__head">
        <div />
        {days.map((date) => {
          const { weekday, day } = dayLabel(date);
          const count = appointments.filter((a) => a.date === date && a.status !== 'cancelled').length;
          return (
            <div key={date} className={`calendar__day-head${date === today ? ' calendar__day-head--today' : ''}`}>
              <strong>{weekday}</strong>
              <span>{day}{count ? ` · ${count}` : ''}</span>
            </div>
          );
        })}
      </div>

      <div className="calendar__body" style={{ height }}>
        <div className="calendar__hours">
          {hours.map((hour) => <span key={hour} style={{ top: y(hour * 60) }}>{String(hour).padStart(2, '0')}:00</span>)}
        </div>

        {days.map((date) => {
          const weekday = isoWeekday(date);
          const blocks = schedules.filter((s) => s.weekday === weekday);
          const dayAppointments = appointments.filter((a) => a.date === date);
          return (
            <div
              key={date}
              className={`calendar__col${blocks.length || !schedules.length ? '' : ' calendar__col--closed'}`}
              onClick={(event) => handleColumnClick(event, date)}
              role="presentation"
            >
              {schedules.length ? blocks.map((block) => (
                <div
                  key={block.id || `${block.start_time}-${block.end_time}`}
                  className="calendar__open"
                  style={{ top: y(toMinutes(block.start_time)), height: y(toMinutes(block.end_time)) - y(toMinutes(block.start_time)) }}
                />
              )) : null}

              {hours.map((hour) => <div key={hour} className="calendar__line" style={{ top: y(hour * 60) }} />)}

              {date === today && now >= startHour * 60 && now <= endHour * 60 ? (
                <div className="calendar__now" style={{ top: y(now) }} aria-hidden="true" />
              ) : null}

              {layoutLanes(dayAppointments).map(({ appointment, start, end, lane, lanes }) => {
                const kind = KINDS[appointment.kind] || KINDS.otro;
                const top = y(Math.max(start, startHour * 60));
                const blockHeight = Math.max(18, y(Math.min(end, endHour * 60)) - top - 2);
                return (
                  <button
                    key={appointment.id}
                    type="button"
                    className={`appt appt--${appointment.kind} appt--${appointment.status}${appointment.is_overbook ? ' appt--overbook' : ''}`}
                    style={{ top, height: blockHeight, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}
                    onClick={() => onAppointmentClick?.(appointment)}
                    title={`${appointment.time}–${endTime(appointment)} · ${appointment.patientName} · ${kind.label} · ${STATUSES[appointment.status]}`}
                  >
                    {blockHeight < 34 ? (
                      <span className="appt__who"><span className="appt__time">{appointment.time}</span> {appointment.patientName}</span>
                    ) : (
                      <>
                        <span className="appt__time">{appointment.time}{appointment.is_overbook ? ' · ST' : ''}</span>
                        <strong className="appt__who">{appointment.patientName}</strong>
                      </>
                    )}
                    {blockHeight > 44 ? (
                      <span className="appt__meta">
                        {kind.short}
                        {appointment.resource ? ` · ${appointment.resource}` : ''}
                        {showProfessional && appointment.professional?.full_name ? ` · ${appointment.professional.full_name}` : ''}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
