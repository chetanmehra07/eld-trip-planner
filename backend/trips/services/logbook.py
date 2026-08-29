"""
Turn the planner's contiguous segments into one "Driver's Daily Log" per
calendar day, mirroring the fields on the paper form:

* graph grid rows (off duty / sleeper berth / driving / on duty) in minutes,
* total hours per row (always summing to 24:00),
* "Remarks" – the place and activity at every change of duty status,
* the 70 hr / 8 day recap (on duty today, last 7 days, available tomorrow, last 8 days).
"""

from __future__ import annotations

from datetime import datetime, time, timedelta
from typing import List

from .hos_planner import (
    CYCLE_LIMIT_MINUTES,
    DRIVING,
    KIND_REMARK,
    ON_DUTY,
    STATUS_LABELS,
    STATUS_ORDER,
    Segment,
)


def build_daily_logs(segments: List[Segment], *, cycle_used_hours: float = 0.0) -> List[dict]:
    if not segments:
        return []

    first_day = segments[0].start.date()
    last_day = (segments[-1].end - timedelta(minutes=1)).date()
    restart_ends = [s.end for s in segments if s.kind == "restart"]
    on_duty_chunks: list[tuple] = []  # (date, start datetime, minutes) for recap maths

    logs: List[dict] = []
    day = first_day
    day_index = 1
    while day <= last_day:
        day_start = datetime.combine(day, time.min)
        day_end = day_start + timedelta(days=1)
        parts: List[dict] = []
        remarks: List[dict] = []

        for seg in segments:
            s = max(seg.start, day_start)
            e = min(seg.end, day_end)
            if e <= s:
                continue
            minutes = (e - s).total_seconds() / 60
            fraction = minutes / seg.duration_minutes if seg.duration_minutes else 0.0
            start_minute = round((s - day_start).total_seconds() / 60)
            end_minute = round((e - day_start).total_seconds() / 60)
            end_name = seg.end_location.name if seg.end_location else None
            parts.append(
                {
                    "kind": seg.kind,
                    "status": seg.status,
                    "status_label": STATUS_LABELS[seg.status],
                    "start_minute": start_minute,
                    "end_minute": end_minute,
                    "label": seg.label,
                    "note": seg.note,
                    "location": seg.location.name,
                    "end_location": end_name,
                    "route_label": f"{seg.location.name} → {end_name}" if end_name else seg.location.name,
                    "miles": round(seg.miles * fraction, 1),
                    "continued_from_previous_day": seg.start < day_start,
                    "continues_next_day": seg.end > day_end,
                }
            )
            if seg.status in (DRIVING, ON_DUTY):
                on_duty_chunks.append((day, s, minutes))
            # A change of duty status that happens on this day → Remarks entry
            if seg.start >= day_start and seg.kind != "off_duty":
                remarks.append(
                    {
                        "minute": start_minute,
                        "time": s.strftime("%H:%M"),
                        "location": seg.location.name,
                        "note": KIND_REMARK.get(seg.kind, seg.label),
                        "label": seg.label,
                    }
                )

        totals = {status: 0 for status in STATUS_ORDER}
        for part in parts:
            totals[part["status"]] += part["end_minute"] - part["start_minute"]

        first, last = parts[0], parts[-1]

        # ---- 70 hr / 8 day recap (honours a completed 34-hour restart)
        latest_restart = max((r for r in restart_ends if r <= day_end), default=None)

        def window_total(days_back: int) -> float:
            lo = day - timedelta(days=days_back - 1)
            total = 0.0
            for chunk_day, chunk_start, chunk_minutes in on_duty_chunks:
                if lo <= chunk_day <= day and (latest_restart is None or chunk_start >= latest_restart):
                    total += chunk_minutes
            if latest_restart is None and lo <= first_day <= day:
                total += cycle_used_hours * 60  # hours carried into the trip
            return total

        last_7 = window_total(7)
        last_8 = window_total(8)
        on_duty_today = totals[DRIVING] + totals[ON_DUTY]

        logs.append(
            {
                "day_index": day_index,
                "date": day.isoformat(),
                "weekday": day.strftime("%A"),
                "from": first["location"],
                "to": last["end_location"] or last["location"],
                "total_miles": round(sum(p["miles"] for p in parts), 1),
                "segments": parts,
                "remarks": remarks,
                "totals": totals,  # minutes per status; always sums to 1440
                "recap": {
                    "on_duty_today": round(on_duty_today),
                    "last_7_days": round(last_7),
                    "available_tomorrow": round(max(0.0, CYCLE_LIMIT_MINUTES - last_7)),
                    "last_8_days": round(last_8),
                    "cycle_limit": CYCLE_LIMIT_MINUTES,
                    "restart_completed": latest_restart is not None,
                },
            }
        )
        day += timedelta(days=1)
        day_index += 1

    return logs
