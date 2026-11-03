"use client";

import { useState, useSyncExternalStore } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 달마다 줄 수가 달라도 높이가 그대로이도록 항상 6주를 그린다.
const WEEK_COUNT = 6;

function subscribeNothing() {
  return () => {};
}

function readToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

// 오늘 날짜는 서버가 아닌 방문자의 브라우저 기준이다. 서버에서 그릴 때는 비워 둔다.
function useToday() {
  return useSyncExternalStore(subscribeNothing, readToday, () => null);
}

function dayColor(weekday: number) {
  if (weekday === 0) return "text-red-600 dark:text-red-400";
  if (weekday === 6) return "text-blue-600 dark:text-blue-400";
  return "";
}

export default function MonthCalendar() {
  const today = useToday();
  const [monthOffset, setMonthOffset] = useState(0);

  if (today === null) {
    return (
      <section
        aria-label="달력"
        className="min-h-80 rounded-3xl border border-stone-200 p-5 dark:border-stone-700"
      />
    );
  }

  const todayDate = new Date(today);
  const firstDay = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth() + monthOffset,
    1,
  );
  const year = firstDay.getFullYear();
  const month = firstDay.getMonth();
  const dayCount = new Date(year, month + 1, 0).getDate();
  const todayNumber = monthOffset === 0 ? todayDate.getDate() : null;

  const weeks = Array.from({ length: WEEK_COUNT }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const day = weekIndex * 7 + weekday - firstDay.getDay() + 1;
      return day >= 1 && day <= dayCount ? day : null;
    }),
  );

  return (
    <section
      aria-label="달력"
      className="min-h-80 rounded-3xl border border-stone-200 p-5 dark:border-stone-700"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => setMonthOffset(monthOffset - 1)}
          className="rounded-full px-3 py-1 text-lg leading-none"
        >
          ‹
        </button>
        <h2 aria-live="polite" className="text-lg font-semibold">
          {year}년 {month + 1}월
        </h2>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => setMonthOffset(monthOffset + 1)}
          className="rounded-full px-3 py-1 text-lg leading-none"
        >
          ›
        </button>
      </div>

      <table className="mt-3 w-full table-fixed text-center text-sm">
        <thead>
          <tr>
            {WEEKDAYS.map((weekday, index) => (
              <th key={weekday} scope="col" className={`py-1 font-medium ${dayColor(index)}`}>
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((days, weekIndex) => (
            <tr key={weekIndex}>
              {days.map((day, weekday) => (
                <td key={weekday} className={`py-0.5 ${dayColor(weekday)}`}>
                  {day === todayNumber && day !== null ? (
                    <span
                      aria-current="date"
                      className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-orange-200 font-semibold text-stone-900"
                    >
                      {day}
                    </span>
                  ) : (
                    day
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
