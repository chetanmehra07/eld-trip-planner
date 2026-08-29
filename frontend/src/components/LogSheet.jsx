import { forwardRef } from 'react';

/**
 * Draws one "Drivers Daily Log (24 hours)" sheet as SVG, matching the paper
 * form: header fields, the 24-hour graph grid with the duty-status line,
 * per-row totals, Remarks (place + activity at every status change),
 * shipping documents and the 70 hr / 8 day recap.
 */
export const SHEET_W = 1000;
export const SHEET_H = 740;

const G = { x: 132, y: 250, w: 768, rowH: 32 };
G.h = G.rowH * 4;
const PX_PER_MIN = G.w / 1440;
const ROWS = ['off_duty', 'sleeper_berth', 'driving', 'on_duty'];
const ROW_LABELS = [['1. Off Duty'], ['2. Sleeper', '    Berth'], ['3. Driving'], ['4. On Duty', '    (not driving)']];

const FONT = "'IBM Plex Sans', Arial, Helvetica, sans-serif";
const MONO = "'IBM Plex Mono', 'Courier New', monospace";
const LINE = '#111827';
const INK = '#1D4ED8';
const MUTED = '#6B7280';

const xAt = (minute) => G.x + minute * PX_PER_MIN;
const rowY = (index) => G.y + index * G.rowH + G.rowH / 2;

function hm(minutes) {
  const t = Math.round(minutes || 0);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

const Label = ({ x, y, children, size = 9, anchor = 'start', color = LINE, weight = 400 }) => (
  <text x={x} y={y} fontFamily={FONT} fontSize={size} textAnchor={anchor} fill={color} fontWeight={weight}>
    {children}
  </text>
);

const Value = ({ x, y, children, size = 11, anchor = 'start', color = INK }) => (
  <text x={x} y={y} fontFamily={MONO} fontSize={size} textAnchor={anchor} fill={color} fontWeight={600}>
    {children}
  </text>
);

const Rule = ({ x1, y1, x2, y2, w = 1, color = LINE }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} />
);

function RecapBox({ x, letter, lines, value, muted = false }) {
  return (
    <g>
      <Label x={x} y={642} size={8.5} weight={700}>
        {letter}
      </Label>
      {lines.map((line, i) => (
        <Label key={i} x={x + 12} y={642 + i * 10} size={8}>
          {line}
        </Label>
      ))}
      <rect x={x} y={678} width={104} height={24} fill="none" stroke={LINE} />
      <Value x={x + 52} y={695} size={12} anchor="middle" color={muted ? MUTED : INK}>
        {value}
      </Value>
    </g>
  );
}

function buildDutyPath(parts) {
  let d = '';
  let previousRow = null;
  for (const part of parts) {
    if (part.end_minute <= part.start_minute) continue;
    const row = ROWS.indexOf(part.status);
    const y = rowY(row);
    const x1 = xAt(part.start_minute);
    const x2 = xAt(part.end_minute);
    if (previousRow !== null && previousRow !== row) d += ` M${x1} ${rowY(previousRow)} L${x1} ${y}`;
    d += ` M${x1} ${y} L${x2} ${y}`;
    previousRow = row;
  }
  return d.trim();
}

const LogSheet = forwardRef(function LogSheet({ log, inputs }, ref) {
  const [year, month, day] = log.date.split('-');
  const parts = [...log.segments].sort((a, b) => a.start_minute - b.start_minute);
  const dutyPath = buildDutyPath(parts);
  const totalMinutes = ROWS.reduce((sum, status) => sum + (log.totals[status] || 0), 0);
  const hourWidth = G.w / 24;
  const quarter = hourWidth / 4;
  const recap = log.recap;
  const commodity = `General freight · ${inputs.pickup_location?.name || '—'}`;

  const ticks = [];
  for (let r = 0; r < 4; r += 1) {
    const top = G.y + r * G.rowH;
    for (let h = 0; h < 24; h += 1) {
      const hx = G.x + h * hourWidth;
      ticks.push(<line key={`h${r}-${h}`} x1={hx} y1={top} x2={hx} y2={top + G.rowH} stroke={LINE} strokeWidth={0.8} />);
      [1, 2, 3].forEach((q) => {
        const len = q === 2 ? G.rowH * 0.5 : G.rowH * 0.28;
        ticks.push(
          <line key={`q${r}-${h}-${q}`} x1={hx + q * quarter} y1={top} x2={hx + q * quarter} y2={top + len} stroke={LINE} strokeWidth={0.6} />,
        );
      });
    }
  }

  const hourLabels = [];
  for (let h = 0; h <= 24; h += 1) {
    const x = G.x + h * hourWidth;
    if (h === 0 || h === 24) {
      hourLabels.push(
        <g key={h}>
          <Label x={x} y={G.y - 15} size={7.5} anchor="middle">Mid-</Label>
          <Label x={x} y={G.y - 6} size={7.5} anchor="middle">night</Label>
        </g>,
      );
    } else {
      hourLabels.push(
        <Label key={h} x={x} y={G.y - 7} size={8.5} anchor="middle" weight={600}>
          {h === 12 ? 'Noon' : String(h % 12)}
        </Label>,
      );
    }
  }

  const totalsX = G.x + G.w + 8;

  // Labels are slanted 60°; only remarks < 15 min apart need an extra vertical stagger.
  const remarkLayout = [];
  log.remarks.forEach((remark) => {
    const x = xAt(remark.minute);
    const previous = remarkLayout[remarkLayout.length - 1];
    const offset = previous && x - previous.x < 12 ? previous.offset + 20 : 0;
    remarkLayout.push({ remark, x, offset });
  });

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${SHEET_W} ${SHEET_H}`}
      width="100%"
      role="img"
      aria-label={`Driver's daily log for ${log.date}`}
      style={{ display: 'block', fontFamily: FONT }}
    >
      <rect x={0} y={0} width={SHEET_W} height={SHEET_H} fill="#FFFFFF" />

      {/* ---------------------------------------------------------------- header */}
      <text x={24} y={36} fontFamily={FONT} fontSize={22} fontWeight={700} fill={LINE}>Drivers Daily Log</text>
      <Label x={24} y={52} size={9}>(24 hours)</Label>

      <Value x={272} y={34} size={14} anchor="middle">{month}</Value>
      <Rule x1={248} y1={38} x2={296} y2={38} />
      <Label x={272} y={50} size={8} anchor="middle">(month)</Label>
      <Label x={306} y={34} size={14}>/</Label>
      <Value x={340} y={34} size={14} anchor="middle">{day}</Value>
      <Rule x1={316} y1={38} x2={364} y2={38} />
      <Label x={340} y={50} size={8} anchor="middle">(day)</Label>
      <Label x={374} y={34} size={14}>/</Label>
      <Value x={414} y={34} size={14} anchor="middle">{year}</Value>
      <Rule x1={384} y1={38} x2={444} y2={38} />
      <Label x={414} y={50} size={8} anchor="middle">(year)</Label>

      <Label x={560} y={26} size={8.5}>Original - File at home terminal.</Label>
      <Label x={560} y={38} size={8.5}>Duplicate - Driver retains in his/her possession for 8 days.</Label>
      <Label x={560} y={54} size={8.5}>Driver:</Label>
      <Value x={598} y={54} size={10}>{inputs.driver_name || '—'}</Value>

      {/* ---------------------------------------------------------------- from / to */}
      <Label x={24} y={80} size={11} weight={700}>From:</Label>
      <Value x={68} y={80}>{log.from}</Value>
      <Rule x1={62} y1={84} x2={470} y2={84} />
      <Label x={500} y={80} size={11} weight={700}>To:</Label>
      <Value x={530} y={80}>{log.to}</Value>
      <Rule x1={524} y1={84} x2={976} y2={84} />

      {/* ---------------------------------------------------------------- mileage boxes */}
      <rect x={24} y={100} width={150} height={44} fill="none" stroke={LINE} />
      <Value x={99} y={128} size={16} anchor="middle">{Math.round(log.total_miles)}</Value>
      <Label x={99} y={156} size={8.5} anchor="middle">Total Miles Driving Today</Label>
      <rect x={190} y={100} width={150} height={44} fill="none" stroke={LINE} />
      <Value x={265} y={128} size={16} anchor="middle">{Math.round(log.total_miles)}</Value>
      <Label x={265} y={156} size={8.5} anchor="middle">Total Mileage Today</Label>

      <rect x={24} y={162} width={316} height={32} fill="none" stroke={LINE} />
      <Value x={182} y={183} size={11} anchor="middle">{inputs.truck_number || '—'}</Value>
      <Label x={182} y={205} size={8} anchor="middle">Truck/Tractor and Trailer Numbers or</Label>
      <Label x={182} y={215} size={8} anchor="middle">License Plate(s)/State (show each unit)</Label>

      {/* ---------------------------------------------------------------- carrier */}
      <Value x={730} y={112} anchor="middle">{inputs.carrier_name || '—'}</Value>
      <Rule x1={480} y1={116} x2={980} y2={116} />
      <Label x={730} y={127} size={8.5} anchor="middle">Name of Carrier or Carriers</Label>
      <Value x={730} y={150} anchor="middle">{inputs.home_terminal || '—'}</Value>
      <Rule x1={480} y1={154} x2={980} y2={154} />
      <Label x={730} y={165} size={8.5} anchor="middle">Main Office Address</Label>
      <Value x={730} y={188} anchor="middle">{inputs.home_terminal || '—'}</Value>
      <Rule x1={480} y1={192} x2={980} y2={192} />
      <Label x={730} y={203} size={8.5} anchor="middle">Home Terminal Address</Label>

      {/* ---------------------------------------------------------------- grid */}
      <Label x={totalsX + 38} y={G.y - 16} size={8.5} anchor="middle" weight={700}>Total</Label>
      <Label x={totalsX + 38} y={G.y - 6} size={8.5} anchor="middle" weight={700}>Hours</Label>
      {hourLabels}
      <rect x={G.x} y={G.y} width={G.w} height={G.h} fill="none" stroke={LINE} strokeWidth={1.2} />
      {[1, 2, 3].map((r) => (
        <Rule key={r} x1={G.x} y1={G.y + r * G.rowH} x2={G.x + G.w} y2={G.y + r * G.rowH} />
      ))}
      {ticks}
      {ROW_LABELS.map((lines, i) =>
        lines.map((text, j) => (
          <Label key={`${i}-${j}`} x={24} y={G.y + i * G.rowH + 14 + j * 10} size={9} weight={600}>
            {text}
          </Label>
        )),
      )}

      <rect x={totalsX} y={G.y} width={76} height={G.h} fill="none" stroke={LINE} />
      {[1, 2, 3].map((r) => (
        <Rule key={`t${r}`} x1={totalsX} y1={G.y + r * G.rowH} x2={totalsX + 76} y2={G.y + r * G.rowH} />
      ))}
      {ROWS.map((status, i) => (
        <Value key={status} x={totalsX + 38} y={rowY(i) + 4} anchor="middle">
          {hm(log.totals[status])}
        </Value>
      ))}
      <Value x={totalsX + 38} y={G.y + G.h + 16} size={11} anchor="middle" color={LINE}>
        = {hm(totalMinutes)}
      </Value>

      {/* duty status line */}
      <path d={dutyPath} fill="none" stroke={INK} strokeWidth={3} strokeLinecap="butt" strokeLinejoin="miter" />

      {/* ---------------------------------------------------------------- remarks */}
      <Rule x1={20} y1={G.y + G.h + 18} x2={20} y2={590} w={3} />
      <text x={26} y={G.y + G.h + 34} fontFamily={FONT} fontSize={12} fontWeight={700} fill={LINE}>Remarks</text>
      {remarkLayout.map(({ remark, x, offset }, i) => {
        const baseY = G.y + G.h;
        return (
          <g key={`${remark.minute}-${i}`}>
            <Rule x1={x} y1={baseY} x2={x} y2={baseY + 10 + offset} w={0.8} color={INK} />
            <text
              x={x}
              y={baseY + 14 + offset}
              transform={`rotate(60 ${x} ${baseY + 14 + offset})`}
              fontFamily={FONT}
              fontSize={8}
              fill={INK}
            >
              {remark.location}{remark.note ? ` – ${remark.note}` : ''}
            </text>
          </g>
        );
      })}

      {/* ---------------------------------------------------------------- shipping documents */}
      <text x={26} y={524} fontFamily={FONT} fontSize={11} fontWeight={700} fill={LINE}>Shipping</text>
      <text x={26} y={537} fontFamily={FONT} fontSize={11} fontWeight={700} fill={LINE}>Documents:</text>
      <Label x={26} y={558} size={9}>DVL or Manifest No. or</Label>
      <Value x={140} y={558}>—</Value>
      <Rule x1={136} y1={561} x2={470} y2={561} />
      <Label x={26} y={580} size={9}>Shipper &amp; Commodity</Label>
      <Value x={140} y={580}>{commodity}</Value>
      <Rule x1={136} y1={583} x2={470} y2={583} />

      <Label x={740} y={560} size={8.5} anchor="middle">
        Enter name of place you reported and where released from work and when and where each change of duty occurred.
      </Label>
      <Label x={740} y={574} size={8.5} anchor="middle" weight={600}>Use time standard of home terminal.</Label>

      {/* ---------------------------------------------------------------- recap */}
      <Rule x1={24} y1={612} x2={976} y2={612} w={1.2} />
      <Label x={24} y={630} size={10} weight={700}>Recap:</Label>
      <Label x={24} y={642} size={8.5}>Complete at</Label>
      <Label x={24} y={652} size={8.5}>end of day</Label>

      <Label x={100} y={630} size={8.5} weight={600}>On duty</Label>
      <Label x={100} y={640} size={8.5}>hours today,</Label>
      <Label x={100} y={650} size={8.5}>Total lines</Label>
      <Label x={100} y={660} size={8.5}>3 &amp; 4</Label>
      <rect x={100} y={678} width={74} height={24} fill="none" stroke={LINE} />
      <Value x={137} y={695} size={12} anchor="middle">{hm(recap.on_duty_today)}</Value>

      <Label x={200} y={630} size={9} weight={700}>70 Hour / 8 Day Drivers</Label>
      <RecapBox x={200} letter="A." lines={['Total hours', 'on duty last 7', 'days including', 'today.']} value={hm(recap.last_7_days)} />
      <RecapBox x={320} letter="B." lines={['Total hours', 'available', 'tomorrow', '70 hr. minus A*']} value={hm(recap.available_tomorrow)} />
      <RecapBox x={440} letter="C." lines={['Total hours', 'on duty last 8', 'days including', 'today.']} value={hm(recap.last_8_days)} />

      <Label x={580} y={630} size={9} weight={700}>60 Hour / 7 Day Drivers</Label>
      <RecapBox x={580} letter="A." lines={['Total hours', 'on duty last 5', 'days including', 'today.']} value="N/A" muted />
      <RecapBox x={700} letter="B." lines={['Total hours', 'available', 'tomorrow', '60 hr. minus A*']} value="N/A" muted />
      <RecapBox x={820} letter="C." lines={['Total hours', 'on duty last 7', 'days including', 'today.']} value="N/A" muted />

      <Label x={942} y={630} size={7.5}>*If you took</Label>
      <Label x={942} y={640} size={7.5}>34 consecutive</Label>
      <Label x={942} y={650} size={7.5}>hours off duty</Label>
      <Label x={942} y={660} size={7.5}>you have 60/70</Label>
      <Label x={942} y={670} size={7.5}>hours available</Label>

      <Label x={24} y={728} size={7.5} color={MUTED}>
        Day {log.day_index} · {log.weekday} · generated by ELD Trip Planner · property-carrying driver, 70 hr / 8 day cycle
        {recap.restart_completed ? ' · 34-hour restart completed' : ''}
      </Label>
    </svg>
  );
});

export default LogSheet;

/** Rasterise the SVG sheet to a PNG download (2× resolution). */
export async function downloadSvgAsPng(svgElement, filename, scale = 2) {
  const clone = svgElement.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(SHEET_W));
  clone.setAttribute('height', String(SHEET_H));
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = SHEET_W * scale;
    canvas.height = SHEET_H * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    await new Promise((resolve) =>
      canvas.toBlob((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        resolve();
      }, 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
