export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface OpenTimeScheduled {
  type: 'scheduled';
  daysFrom: DayOfWeek;
  daysTo: DayOfWeek;
  openHour: number;
  closeHour: number;
}

export interface OpenTimeAlways {
  type: 'always';
}

export type OpenTime = OpenTimeScheduled | OpenTimeAlways;
