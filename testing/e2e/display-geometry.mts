export function require360DpDisplay(display: string, density: string): number {
  const dimensions =
    /Override size: (\d+)x(\d+)/.exec(display) ??
    /Physical size: (\d+)x(\d+)/.exec(display);
  const densityValue =
    /Override density: (\d+)/.exec(density) ??
    /Physical density: (\d+)/.exec(density);
  if (!dimensions || !densityValue)
    throw new Error('Display geometry unavailable');
  const widthDp = (Number(dimensions[1]) * 160) / Number(densityValue[1]);
  if (widthDp !== 360)
    throw new Error(
      `Layout checks require an observed 360dp viewport; got ${widthDp}`,
    );
  return widthDp;
}
