import { scaleLinear } from 'd3-scale';
import { LAST_HOUR } from '../config/clinical';

/** Left gutter and right margin shared by the patient charts so their plot areas align. */
export const GUTTER = 124;
export const RIGHT = 56;

/** Hour 0..47, each hour owning one cell, so cells and points are centred on the same grid. */
export const timeScale = (left: number, right: number) =>
  scaleLinear().domain([-0.5, LAST_HOUR + 0.5]).range([left, right]);

/** Sequential single-hue steps for the risk heatmap, light to dark blue. */
export const HEAT_STEPS = ['#EAF1FE', '#C3D7FB', '#8DB2F6', '#4C86EE', '#1D4ED8'];
export const heatColor = (pts: number) => HEAT_STEPS[Math.min(4, Math.floor(pts / 20))];
