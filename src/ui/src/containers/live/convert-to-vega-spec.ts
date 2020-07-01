/* eslint-disable @typescript-eslint/no-use-before-define */
import { Theme } from '@material-ui/core/styles';
import { addPxTimeFormatExpression } from 'components/live-widgets/vega/timeseries-axis';
import * as _ from 'lodash';
import {
  Axis,
  Data,
  EncodeEntryName,
  GroupMark,
  Legend,
  LineMark,
  Mark,
  OnEvent,
  Scale,
  Signal,
  Spec as VgSpec,
  SymbolMark,
  TrailEncodeEntry,
  Transforms,
  AreaMark,
  ScaleMultiFieldsRef,
} from 'vega';
import { vegaLite, VisualizationSpec } from 'vega-embed';
import { TopLevelSpec as VlSpec } from 'vega-lite';

import { DISPLAY_TYPE_KEY, WidgetDisplay } from './vis';

addPxTimeFormatExpression();

export const BAR_CHART_TYPE = 'pixielabs.ai/pl.vispb.BarChart';
const VEGA_CHART_TYPE = 'pixielabs.ai/pl.vispb.VegaChart';
const VEGA_LITE_V4 = 'https://vega.github.io/schema/vega-lite/v4.json';
const VEGA_V5 = 'https://vega.github.io/schema/vega/v5.json';
const VEGA_SCHEMA = '$schema';
export const TIMESERIES_CHART_TYPE = 'pixielabs.ai/pl.vispb.TimeseriesChart';
export const COLOR_SCALE = 'color';
const HOVER_LINE_COLOR = '#4dffd4';
const HOVER_TIME_COLOR = '#121212';
const HOVER_LINE_OPACITY = 0.75;
const HOVER_LINE_DASH = [6, 6];
const HOVER_LINE_WIDTH = 2;
const LINE_WIDTH = 1.0;
const HIGHLIGHTED_LINE_WIDTH = 3.0;
const SELECTED_LINE_OPACITY = 1.0;
const UNSELECTED_LINE_OPACITY = 0.2;
const AXIS_HEIGHT = 25;

const HOVER_BULB_OFFSET = 10;
const HOVER_LINE_TEXT_OFFSET = 6;

interface XAxis {
  readonly label: string;
}

interface YAxis {
  readonly label: string;
}

interface DisplayWithLabels {
  readonly title?: string;
  readonly xAxis?: XAxis;
  readonly yAxis?: YAxis;
}

interface Timeseries {
  readonly value: string;
  readonly mode?: string;
  readonly series?: string;
  readonly stackBySeries?: boolean;
}

interface TimeseriesDisplay extends WidgetDisplay, DisplayWithLabels {
  readonly timeseries: Timeseries[];
}

interface Bar {
  readonly value: string;
  readonly label: string;
  readonly stackBy?: string;
  readonly groupBy?: string;
}

interface BarDisplay extends WidgetDisplay, DisplayWithLabels {
  readonly bar: Bar;
}

interface VegaDisplay extends WidgetDisplay {
  readonly spec: string;
}

// Currently, only lines, points, and area are supported for timeseries.
type TimeseriesMark = LineMark | SymbolMark | AreaMark;

export interface VegaSpecWithProps {
  spec: VgSpec;
  hasLegend: boolean;
  legendColumnName: string;
  error?: Error;
}

export type ChartDisplay = TimeseriesDisplay | BarDisplay | VegaDisplay;

function convertWidgetDisplayToSpecWithErrors(display: ChartDisplay, source: string): VegaSpecWithProps {
  switch (display[DISPLAY_TYPE_KEY]) {
    case BAR_CHART_TYPE:
      return convertToBarChart(display as BarDisplay, source);
    case TIMESERIES_CHART_TYPE:
      return convertToTimeseriesChart(display as TimeseriesDisplay, source);
    case VEGA_CHART_TYPE:
      return convertToVegaChart(display as VegaDisplay);
    default:
      return {
        spec: {},
        legendColumnName: null,
        hasLegend: false,
        error: new Error(`Unsupported display type: ${display[DISPLAY_TYPE_KEY]}`),
      };
  }
}

export function convertWidgetDisplayToVegaSpec(display: ChartDisplay, source: string, theme: Theme): VegaSpecWithProps {
  try {
    const specWithProps = convertWidgetDisplayToSpecWithErrors(display, source);
    hydrateSpecWithTheme(specWithProps.spec, theme);
    return specWithProps;
  } catch (error) {
    return {
      spec: {},
      hasLegend: false,
      legendColumnName: '',
      error,
    };
  }
}

const BASE_SPEC: VgSpec = {
  [VEGA_SCHEMA]: VEGA_V5,
};

/* Vega Spec Functions */
function addAutosize(spec: VgSpec) {
  spec.autosize = {
    type: 'fit',
    contains: 'padding',
  };
}

function addTitle(spec: VgSpec, title: string) {
  spec.title = {
    text: title,
  };
}

function addDataSource(spec: VgSpec, dataSpec: Data): Data {
  if (!spec.data) {
    spec.data = [];
  }
  spec.data.push(dataSpec);
  return dataSpec;
}

function addMark(spec: VgSpec | GroupMark, markSpec: Mark): Mark {
  if (!spec.marks) {
    spec.marks = [];
  }
  spec.marks.push(markSpec);
  return markSpec;
}

function addSignal(spec: VgSpec, sigSpec: Signal): Signal {
  if (!spec.signals) {
    spec.signals = [];
  }
  spec.signals.push(sigSpec);
  return sigSpec;
}

function addScale(spec: VgSpec, scaleSpec: Scale): Scale {
  if (!spec.scales) {
    spec.scales = [];
  }
  spec.scales.push(scaleSpec);
  return scaleSpec;
}

function addAxis(spec: VgSpec | GroupMark, axisSpec: Axis): Axis {
  if (!spec.axes) {
    spec.axes = [];
  }
  spec.axes.push(axisSpec);
  return axisSpec;
}

function addLegend(spec: VgSpec, legendSpec: Legend): Legend {
  if (!spec.legends) {
    spec.legends = [];
  }
  spec.legends.push(legendSpec);
  return legendSpec;
}

/* Data Functions */
function extendDataTransforms(data: Data, transforms: Transforms[]) {
  if (!data.transform) {
    data.transform = [];
  }
  data.transform.push(...transforms);
}

/* Data Transforms */
function timeFormatTransform(timeField: string): Transforms[] {
  return [{
    type: 'formula',
    expr: `toDate(datum["${timeField}"])`,
    as: timeField,
  }];
}

function trimFirstAndLastTimestepTransform(timeField: string): Transforms[] {
  // NOTE(philkuz): These transforms are a hack to remove sampling artifacts created by our
  // range-agg. This should be fixed with the implementation of the window aggregate. A side-effect
  // of this hack is that any time-series created w/o range-agg will also have time-boundaries
  // removed. I'd argue that doesn't hurt the experience because those points would be missing if
  // they executed the live-view 1 sampling window earlier or later, where sampling windows
  // typically are 1-10s long.
  return [
    {
      type: 'joinaggregate',
      as: [
        'min_time',
        'max_time',
      ],
      ops: [
        'min',
        'max',
      ],
      fields: [
        timeField,
        timeField,
      ],
    },
    {
      type: 'filter',
      expr: `datum.${timeField} > datum.min_time && datum.${timeField} < datum.max_time`,
    },
  ];
}

function legendDataTransform(display: TimeseriesDisplay): Transforms[] {
  // If no series in any of the timeseries, we should copy the data from the main data source,
  // and keep only the value fields + time_.
  if (display.timeseries.map((ts) => ts.series).filter((series) => series).length === 0) {
    return [{
      type: 'project',
      fields: [...display.timeseries.map((ts) => ts.value), TIME_FIELD],
    }];
  }
  if (display.timeseries.length === 1 && display.timeseries[0].series) {
    return [{
      type: 'pivot',
      field: display.timeseries[0].series,
      value: display.timeseries[0].value,
      groupby: [TIME_FIELD],
    }];
  }
  throw new Error('Multiple timeseries with subseries are not supported.');
}

function stackBySeriesTransform(
  timeField: string,
  valueField: string,
  seriesField: string,
  stackedStartField: string,
  stackedEndField: string): Transforms[] {
  const meanValueField = 'meanOfValueField';
  return [
    // We do a join aggregate so that we can sort the stack by the mean value per series.
    // So that the more "important" fields end up on the top of the stack.
    {
      type: 'joinaggregate',
      groupby: [seriesField],
      ops: ['mean'],
      fields: [valueField],
      as: [meanValueField],
    },
    {
      type: 'stack',
      groupby: [timeField],
      sort: { field: meanValueField, order: 'ascending' },
      field: valueField,
      as: [stackedStartField, stackedEndField],
    },
  ];
}

/* Mark Functions */
function extendMarkEncoding(mark: Mark, encodeEntryName: EncodeEntryName, entry: Partial<TrailEncodeEntry>) {
  if (!mark.encode) {
    mark.encode = {};
  }
  if (!mark.encode[encodeEntryName]) {
    mark.encode[encodeEntryName] = {};
  }
  mark.encode[encodeEntryName] = { ...mark.encode[encodeEntryName], ...entry };
}

/* Signal Functions */
function extendSignalHandlers(signal: Signal, on: OnEvent[]) {
  if (!signal.on) {
    signal.on = [];
  }
  signal.on.push(...on);
}

function getMarkType(mode: string): TimeseriesMark['type'] {
  switch (mode) {
    case 'MODE_POINT':
      return 'symbol';
    case 'MODE_AREA':
      return 'area';
    case 'MODE_UNKNOWN':
    case 'MODE_LINE':
    default:
      return 'line';
  }
}

function addWidthHeightSignals(spec: VgSpec, widthName = 'width', heightName = 'height') {
  const widthUpdate = 'isFinite(containerSize()[0]) ? containerSize()[0] : 200';
  const heightUpdate = 'isFinite(containerSize()[1]) ? containerSize()[1] : 200';
  const widthSignal = addSignal(spec, {
    name: widthName,
    init: widthUpdate,
    on: [{
      events: 'window:resize',
      update: widthUpdate,
    }],
  });
  const heightSignal = addSignal(spec, {
    name: heightName,
    init: heightUpdate,
    on: [{
      events: 'window:resize',
      update: heightUpdate,
    }],
  });
  return { widthSignal, heightSignal };
}

interface ReverseSignals {
  reverseSelectSignal: Signal;
  reverseHoverSignal: Signal;
  reverseUnselectSignal: Signal;
}

function addHoverSelectSignals(spec: VgSpec): ReverseSignals {
  addSignal(spec, {
    name: INTERNAL_HOVER_SIGNAL,
    on: [
      {
        events: [{
          source: 'scope',
          type: 'mouseover',
          markname: HOVER_VORONOI,
        }],
        update: `datum && datum.datum && {${TIME_FIELD}: datum.datum["${TIME_FIELD}"]}`,
      },
      {
        events: [{
          source: 'view',
          type: 'mouseout',
          filter: 'event.type === "mouseout"',
        }],
        update: 'null',
      },
    ],
  });
  addSignal(spec, { name: EXTERNAL_HOVER_SIGNAL, value: null });
  addSignal(spec, {
    name: HOVER_SIGNAL,
    on: [
      {
        events: [
          { signal: INTERNAL_HOVER_SIGNAL },
          { signal: EXTERNAL_HOVER_SIGNAL },
        ],
        update: `${INTERNAL_HOVER_SIGNAL} || ${EXTERNAL_HOVER_SIGNAL}`,
      },
    ],
  });

  addSignal(spec, { name: LEGEND_SELECT_SIGNAL, value: [] });
  addSignal(spec, { name: LEGEND_HOVER_SIGNAL, value: 'null' });
  const reverseHoverSignal = addSignal(spec, { name: REVERSE_HOVER_SIGNAL });
  const reverseSelectSignal = addSignal(spec, { name: REVERSE_SELECT_SIGNAL });
  const reverseUnselectSignal = addSignal(spec, { name: REVERSE_UNSELECT_SIGNAL });
  return { reverseHoverSignal, reverseSelectSignal, reverseUnselectSignal };
}

function addTimeseriesDomainSignals(spec: VgSpec, scaleName: string): Signal {
  // Add signal to determine hover time value for current chart.
  addSignal(spec, {
    name: INTERNAL_TS_DOMAIN_SIGNAL,
    on: [
      {
        events: { scale: scaleName },
        update: `domain('${scaleName}')`,
      },
    ],
  });
  // Add signal for hover value from external chart.
  addSignal(spec, { name: EXTERNAL_TS_DOMAIN_SIGNAL, value: null });
  // Add signal for hover value that merges internal, and external hover values, with priority to internal.
  return addSignal(spec, {
    name: TS_DOMAIN_SIGNAL,
    on: [
      {
        events: [{ signal: INTERNAL_TS_DOMAIN_SIGNAL }, { signal: EXTERNAL_TS_DOMAIN_SIGNAL }],
        update: `combineInternalExternal(${INTERNAL_TS_DOMAIN_SIGNAL}, ${EXTERNAL_TS_DOMAIN_SIGNAL})`,
      },
    ],
  });
}

function extendReverseSignalsWithHitBox(
  { reverseHoverSignal, reverseSelectSignal, reverseUnselectSignal }: ReverseSignals,
  hitBoxMarkName: string,
  interactivitySelector: string) {
  extendSignalHandlers(reverseHoverSignal, [
    {
      events: {
        source: 'view',
        type: 'mouseover',
        markname: hitBoxMarkName,
      },
      update: `datum && ${interactivitySelector}`,
    },
    {
      events: {
        source: 'view',
        type: 'mouseout',
        markname: hitBoxMarkName,
      },
      update: 'null',
    },
  ]);
  extendSignalHandlers(reverseSelectSignal, [
    {
      events: {
        source: 'view',
        type: 'click',
        markname: hitBoxMarkName,
      },
      update: `datum && ${interactivitySelector}`,
      force: true,
    },
  ]);
  extendSignalHandlers(reverseUnselectSignal, [
    {
      events: {
        source: 'view',
        type: 'mousedown',
        markname: hitBoxMarkName,
        consume: true,
        filter: `event.which === ${RIGHT_MOUSE_DOWN_CODE}`,
      },
      update: 'true',
      force: true,
    },
  ]);
}

function addInteractivityHitBox(spec: VgSpec | GroupMark, lineMark: TimeseriesMark, name: string): Mark {
  return addMark(spec, {
    ...lineMark,
    name,
    type: lineMark.type,
    encode: {
      ...lineMark.encode,
      update: {
        ...lineMark.encode.update,
        opacity: [{
          value: 0,
        }],
        strokeWidth: [{
          value: LINE_HOVER_HIT_BOX_WIDTH,
        }],
      },
    },
    zindex: lineMark.zindex + 1,
  });
}

function addLegendInteractivityEncodings(mark: Mark, ts: Timeseries, interactivitySelector: string) {
  extendMarkEncoding(mark, 'update', {
    opacity: [
      {
        value: SELECTED_LINE_OPACITY,
        test: `${LEGEND_HOVER_SIGNAL} && (${interactivitySelector} === ${LEGEND_HOVER_SIGNAL})`,
      },
      {
        value: UNSELECTED_LINE_OPACITY,
        test:
        `${LEGEND_SELECT_SIGNAL}.length !== 0 && indexof(${LEGEND_SELECT_SIGNAL}, ${interactivitySelector}) === -1`,
      },
      { value: SELECTED_LINE_OPACITY },
    ],
    strokeWidth: [
      {
        value: HIGHLIGHTED_LINE_WIDTH,
        test: `${LEGEND_HOVER_SIGNAL} && (${interactivitySelector} === ${LEGEND_HOVER_SIGNAL})`,
      },
      {
        value: LINE_WIDTH,
      },
    ],
  });
}

function createTSScales(
  spec: VgSpec,
  transformedDataSrc: Data,
  tsDomainSignal: Signal,
  timeseries: Timeseries[],
  dupXScaleName: string): {xScale: Scale; yScale: Scale; colorScale: Scale} {
  const xScale = addScale(spec, {
    name: 'x',
    type: 'time',
    domain: {
      data: transformedDataSrc.name,
      field: TIME_FIELD,
    },
    range: [0, { signal: 'width' }],
    domainRaw: { signal: tsDomainSignal.name },
  });
  // Duplicates the Xscale so that when we update the time domain to match other charts we don't create a feedback loop.
  addScale(spec, {
    ...xScale,
    name: dupXScaleName,
    domainRaw: undefined,
  });
  const yScale = addScale(spec, {
    name: 'y',
    type: 'linear',
    domain: {
      data: transformedDataSrc.name,
      fields: _.uniq(timeseries.map((ts) => ts.value)),
    },
    range: [{ signal: 'height' }, 0],
    zero: false,
    nice: true,
  });
  // The Color scale's domain is filled out later.
  const colorScale = addScale(spec, {
    name: 'color',
    type: 'ordinal',
    range: 'category',
  });
  return { xScale, yScale, colorScale };
}

// TODO(philkuz/reviewer) should this come from somewhere else?
const X_AXIS_LABEL_SEPARATION = 100; // px
const X_AXIS_LABEL_FONT = 'Roboto';
const X_AXIS_LABEL_FONT_SIZE = 10;
const PX_BETWEEN_X_TICKS = 20;
const PX_BETWEEN_Y_TICKS = 40;

function addLabelsToAxes(xAxis: Axis, yAxis: Axis, display: DisplayWithLabels) {
  if (display.xAxis && display.xAxis.label) {
    xAxis.title = display.xAxis.label;
  }
  if (display.yAxis && display.yAxis.label) {
    yAxis.title = display.yAxis.label;
  }
}

function createTSAxes(spec: VgSpec, xScale: Scale, yScale: Scale, display: DisplayWithLabels) {
  const xAxis = addAxis(spec, {
    scale: xScale.name,
    orient: 'bottom',
    grid: false,
    labelFlush: true,
    tickCount: {
      signal: `ceil(width/${PX_BETWEEN_X_TICKS})`,
    },
    labelOverlap: true,
    encode: {
      labels: {
        update: {
          text: {
            signal: `pxTimeFormat(datum, ceil(width), ceil(width/${PX_BETWEEN_X_TICKS}),`
            + ` ${X_AXIS_LABEL_SEPARATION}, "${X_AXIS_LABEL_FONT}", ${X_AXIS_LABEL_FONT_SIZE})`,
          },
        },
      },
    },
    zindex: 0,
  });
  const yAxis = addAxis(spec, {
    scale: yScale.name,
    orient: 'left',
    gridScale: xScale.name,
    grid: true,
    tickCount: {
      signal: `ceil(height/${PX_BETWEEN_Y_TICKS})`,
    },
    labelOverlap: true,
    zindex: 0,
  });
  addLabelsToAxes(xAxis, yAxis, display);
}

// Z ordering
const PLOT_GROUP_Z_LAYER = 100;
const VORONOI_Z_LAYER = 99;

function convertToTimeseriesChart(display: TimeseriesDisplay, source: string): VegaSpecWithProps {
  if (!display.timeseries) {
    throw new Error('TimeseriesChart must have one timeseries entry');
  }
  const spec = { ...BASE_SPEC };
  addAutosize(spec);
  spec.style = 'cell';

  // Create data sources.
  const baseDataSrc = addDataSource(spec, { name: source });
  const transformedDataSrc = addDataSource(spec, {
    name: 'transformedData',
    source: baseDataSrc.name,
    transform: [
      ...timeFormatTransform(TIME_FIELD),
      ...trimFirstAndLastTimestepTransform(TIME_FIELD),
    ],
  });
  const legendData = addDataSource(spec, {
    name: HOVER_PIVOT_TRANSFORM,
    source: transformedDataSrc.name,
    transform: [
      ...legendDataTransform(display),
    ],
  });

  // Create signals.
  addWidthHeightSignals(spec);
  const reverseSignals = addHoverSelectSignals(spec);
  const dupXScaleName = '_x_signal';
  const tsDomainSignal = addTimeseriesDomainSignals(spec, dupXScaleName);

  // Create scales/axes.
  const { xScale, yScale, colorScale } = createTSScales(
    spec, transformedDataSrc, tsDomainSignal, display.timeseries, dupXScaleName);
  createTSAxes(spec, xScale, yScale, display);

  // Create marks for ts lines.
  let i = 0;
  let legendColumnName = '';
  for (const timeseries of display.timeseries) {
    let group: VgSpec | GroupMark = spec;
    let dataName = transformedDataSrc.name;
    if (timeseries.series && display.timeseries.length > 1) {
      throw new Error('Subseries are not supported for multiple timeseries within a TimeseriesChart');
    }
    if (timeseries.stackBySeries && !timeseries.series) {
      throw new Error('Stack by series is not supported when series is not specified.');
    }
    if (timeseries.series) {
      dataName = `faceted_data_${i}`;
      group = addMark(spec, {
        name: `timeseries_group_${i}`,
        type: 'group',
        from: {
          facet: {
            name: dataName,
            data: transformedDataSrc.name,
            groupby: [timeseries.series],
          },
        },
        encode: {
          update: {
            width: {
              field: {
                group: 'width',
              },
            },
            height: {
              field: {
                group: 'height',
              },
            },
          },
        },
        zindex: PLOT_GROUP_Z_LAYER,
      });
      colorScale.domain = {
        data: transformedDataSrc.name,
        field: timeseries.series,
        sort: true,
      };
      legendColumnName = timeseries.series;
    } else {
      if (!colorScale.domain) {
        colorScale.domain = [];
      }
      (colorScale.domain as string[]).push(timeseries.value);
    }

    const stackedValueStart = `${timeseries.value}_stacked_start`;
    const stackedValueEnd = `${timeseries.value}_stacked_end`;
    if (timeseries.stackBySeries) {
      extendDataTransforms(transformedDataSrc,
        stackBySeriesTransform(TIME_FIELD, timeseries.value, timeseries.series, stackedValueStart, stackedValueEnd));
      // Adjust yScale to use new start/end stacked values.
      (yScale.domain as ScaleMultiFieldsRef).fields = [stackedValueStart, stackedValueEnd];
    }

    const markType = getMarkType(timeseries.mode);
    if (markType === 'area' && !timeseries.stackBySeries) {
      throw new Error('Area charts not supported unless stacked by series.');
    }
    const yField = (timeseries.stackBySeries) ? stackedValueEnd : timeseries.value;
    const lineMark = addMark(group, {
      name: `timeseries_line_${i}`,
      type: markType,
      style: markType,
      from: {
        data: dataName,
      },
      sort: {
        field: `datum["${TIME_FIELD}"]`,
      },
      encode: {
        update: {
          x: { scale: xScale.name, field: TIME_FIELD },
          y: { scale: yScale.name, field: yField },
          ...((markType === 'area') ? { y2: { scale: yScale.name, field: stackedValueStart } } : {}),
        },
      },
      zindex: PLOT_GROUP_Z_LAYER,
    }) as TimeseriesMark;

    if (timeseries.series) {
      extendMarkEncoding(lineMark, 'update', {
        stroke: { scale: colorScale.name, field: timeseries.series },
        ...((markType === 'area') ? { fill: { scale: colorScale.name, field: timeseries.series } } : {}),
      });
    } else {
      extendMarkEncoding(lineMark, 'update', {
        stroke: { scale: colorScale.name, value: timeseries.value },
      });
    }

    // NOTE(james): if there is no series given, then the selector for interactivity with the legend
    // is the name of the value field. Otherwise we use the value of the series field as the selector.
    // This will cause problems if multiple timeseries are specified with the same value field, but until we
    // support multiple tables in the same timeseries chart there isn't a problem.
    const interactivitySelector = (timeseries.series) ? `datum["${timeseries.series}"]` : `"${timeseries.value}"`;
    addLegendInteractivityEncodings(lineMark, timeseries, interactivitySelector);
    const hitBoxMark = addInteractivityHitBox(group, lineMark, `${LINE_HIT_BOX_MARK_NAME}_${i}`);
    extendReverseSignalsWithHitBox(reverseSignals, hitBoxMark.name, interactivitySelector);
    i++;
  }

  addHoverMarks(spec, legendData.name);

  if (display.title) {
    addTitle(spec, display.title);
  }

  return {
    spec,
    // At the moment, timeseries always have legends.
    hasLegend: true,
    legendColumnName,
  };
}

function addGridLayout(spec: VgSpec, columnDomainData: Data) {
  spec.layout = {
    // TODO(james): figure out the best way to get this from the theme.
    padding: 20,
    titleAnchor: {
      column: 'end',
    },
    offset: {
      columnTitle: 10,
    },
    columns: {
      signal: `length(data("${columnDomainData.name}"))`,
    },
    bounds: 'full',
    align: 'all',
  };
}

function addGridLayoutMarksForGroupedBars(
  spec: VgSpec,
  groupBy: string,
  labelField: string,
  columnDomainData: Data,
  widthName: string,
  heightName: string): {groupForXAxis: GroupMark; groupForYAxis: GroupMark} {
  addMark(spec, {
    name: 'column-title',
    type: 'group',
    role: 'column-title',
    title: {
      text: `${groupBy}, ${labelField}`,
      orient: 'bottom',
      offset: 10,
      style: 'grouped-bar-x-title',
    },
  });

  const groupForYAxis = addMark(spec, {
    name: 'row-header',
    type: 'group',
    role: 'row-header',
    encode: {
      update: {
        height: {
          signal: heightName,
        },
      },
    },
  }) as GroupMark;

  const groupForXAxis = addMark(spec, {
    name: 'column-footer',
    type: 'group',
    role: 'column-footer',
    from: {
      data: columnDomainData.name,
    },
    sort: {
      field: `datum["${groupBy}"]`,
      order: 'ascending',
    },
    title: {
      text: {
        signal: `parent["${groupBy}"]`,
      },
      frame: 'group',
      orient: 'bottom',
      offset: 10,
      style: 'grouped-bar-x-subtitle',
    },
    encode: {
      update: {
        width: {
          signal: widthName,
        },
      },
    },
  }) as GroupMark;
  return { groupForXAxis, groupForYAxis };
}

function convertToBarChart(display: BarDisplay, source: string): VegaSpecWithProps {
  if (!display.bar) {
    throw new Error('BarChart must have an entry for property bar');
  }
  if (!display.bar.value) {
    throw new Error('BarChart property bar must have an entry for property value');
  }
  if (!display.bar.label) {
    throw new Error('BarChart property bar must have an entry for property label');
  }

  const spec = { ...BASE_SPEC };
  if (!display.bar.groupBy) {
    addAutosize(spec);
    spec.style = 'cell';
  }

  // Add data and transforms.
  const baseDataSrc = addDataSource(spec, { name: source });
  const transformedDataSrc = addDataSource(spec, { name: 'transformedData', source: baseDataSrc.name, transform: [] });
  let valueField = display.bar.value;
  let valueStartField = '';
  let valueEndField = valueField;
  if (display.bar.stackBy) {
    valueField = `sum_${display.bar.value}`;
    valueStartField = `${valueField}_start`;
    valueEndField = `${valueField}_end`;
    const extraGroupBy = (display.bar.groupBy) ? [display.bar.groupBy] : [];
    extendDataTransforms(transformedDataSrc, [
      {
        type: 'aggregate',
        groupby: [display.bar.label, display.bar.stackBy, ...extraGroupBy],
        ops: ['sum'],
        fields: [display.bar.value],
        as: [valueField],
      },
      {
        type: 'stack',
        groupby: [display.bar.label, ...extraGroupBy],
        field: valueField,
        sort: { field: [display.bar.stackBy], order: ['descending'] },
        as: [valueStartField, valueEndField],
        offset: 'zero',
      },
    ]);
  }
  let columnDomainData: Data;
  if (display.bar.groupBy) {
    columnDomainData = addDataSource(spec, {
      name: 'column-domain',
      source: transformedDataSrc.name,
      transform: [
        {
          type: 'aggregate',
          groupby: [display.bar.groupBy],
        },
      ],
    });
  }

  // Add signals.
  const widthName = (display.bar.groupBy) ? 'child_width' : 'width';
  const heightName = (display.bar.groupBy) ? 'child_height' : 'height';
  addWidthHeightSignals(spec, widthName, heightName);

  // Add scales.
  const xScale = addScale(spec, {
    name: 'x',
    type: 'band',
    domain: {
      data: transformedDataSrc.name,
      field: display.bar.label,
      sort: true,
    },
    range: [
      0,
      { signal: widthName },
    ],
  });

  const yScale = addScale(spec, {
    name: 'y',
    type: 'linear',
    domain: {
      data: transformedDataSrc.name,
      fields: (valueStartField) ? [valueStartField, valueEndField] : [valueField],
    },
    range: [
      { signal: heightName },
      0,
    ],
    nice: true,
    zero: true,
  });

  const colorScale = addScale(spec, {
    name: 'color',
    type: 'ordinal',
    range: 'category',
    domain: (!display.bar.stackBy) ? [valueField] : {
      data: transformedDataSrc.name,
      field: display.bar.stackBy,
      sort: true,
    },
  });

  // Add marks.
  let group: VgSpec | GroupMark = spec;
  let dataName = transformedDataSrc.name;
  let groupForXAxis: VgSpec | GroupMark = spec;
  let groupForYAxis: VgSpec | GroupMark = spec;
  if (display.bar.groupBy) {
    // We use vega's grid layout functionality to plot grouped bars.
    ({ groupForXAxis, groupForYAxis } = addGridLayoutMarksForGroupedBars(
      spec, display.bar.groupBy, display.bar.label, columnDomainData, widthName, heightName));
    addGridLayout(spec, columnDomainData);
    dataName = 'facetedData';
    group = addMark(spec, {
      name: 'barGroup',
      type: 'group',
      style: 'cell',
      from: {
        facet: {
          name: dataName,
          data: transformedDataSrc.name,
          groupby: [display.bar.groupBy],
        },
      },
      sort: {
        field: [`datum["${display.bar.groupBy}"]`],
        order: ['ascending'],
      },
      encode: {
        update: {
          width: {
            signal: widthName,
          },
          height: {
            signal: heightName,
          },
        },
      },
    }) as GroupMark;
  }

  addMark(group, {
    name: 'barMark',
    type: 'rect',
    style: 'bar',
    from: {
      data: dataName,
    },
    encode: {
      update: {
        fill: {
          scale: colorScale.name,
          ...((display.bar.stackBy) ? { field: display.bar.stackBy } : { value: valueField }),
        },
        x: {
          scale: xScale.name,
          field: display.bar.label,
        },
        y: {
          scale: yScale.name,
          field: valueEndField,
        },
        y2: {
          scale: yScale.name,
          ...((valueStartField) ? { field: valueStartField } : { value: 0 }),
        },
        width: {
          scale: xScale.name,
          band: 1,
        },
      },
    },
  });

  const xAxis = addAxis(groupForXAxis, {
    scale: xScale.name,
    orient: 'bottom',
    grid: false,
    labelAlign: 'right',
    labelAngle: 270,
    labelBaseline: 'middle',
    labelOverlap: true,
  });
  const yAxis = addAxis(groupForYAxis, {
    scale: yScale.name,
    orient: 'left',
    gridScale: xScale.name,
    grid: true,
    labelOverlap: true,
    tickCount: {
      signal: `ceil(${heightName}/${PX_BETWEEN_Y_TICKS})`,
    },
  });
  addLabelsToAxes(xAxis, yAxis, display);

  if (display.bar.stackBy) {
    addLegend(spec, {
      fill: colorScale.name,
      symbolType: 'square',
      title: display.bar.stackBy,
      encode: {
        symbols: {
          update: {
            stroke: {
              value: null,
            },
          },
        },
      },
    });
  }

  if (display.title) {
    addTitle(spec, display.title);
  }

  return {
    spec,
    hasLegend: false,
    legendColumnName: '',
  };
}

function convertToVegaChart(display: VegaDisplay): VegaSpecWithProps {
  const spec: VisualizationSpec = JSON.parse(display.spec);
  let vgSpec: VgSpec;
  if (!spec[VEGA_SCHEMA]) {
    spec[VEGA_SCHEMA] = VEGA_V5;
  }
  if (spec[VEGA_SCHEMA] === VEGA_LITE_V4) {
    vgSpec = vegaLite.compile(spec as VlSpec).spec;
  } else {
    vgSpec = spec as VgSpec;
  }
  return {
    spec: vgSpec,
    hasLegend: false,
    legendColumnName: '',
  };
}

const HOVER_VORONOI = 'hover_voronoi_layer';
const TIME_FIELD = 'time_';
const HOVER_RULE = 'hover_rule_layer';
const HOVER_BULB = 'hover_bulb_layer';
const HOVER_LINE_TIME = 'hover_time_mark';
const HOVER_LINE_TEXT_BOX = 'hover_line_text_box_mark';
const HOVER_LINE_TEXT_PADDING = 3;
// Width of the clickable area of a line.
// Tweaked to a value that felt natural to click on without much effort.
const LINE_HOVER_HIT_BOX_WIDTH = 7.0;
// // Name of the mark that holds the hover interaction.
const LINE_HIT_BOX_MARK_NAME = 'hover_line_mark_layer';
const RIGHT_MOUSE_DOWN_CODE = 3;
export const HOVER_SIGNAL = 'hover_value';
export const EXTERNAL_HOVER_SIGNAL = 'external_hover_value';
export const INTERNAL_HOVER_SIGNAL = 'internal_hover_value';
export const HOVER_PIVOT_TRANSFORM = 'hover_pivot_data';
export const LEGEND_SELECT_SIGNAL = 'selected_series';
export const LEGEND_HOVER_SIGNAL = 'legend_hovered_series';
export const REVERSE_HOVER_SIGNAL = 'reverse_hovered_series';
export const REVERSE_SELECT_SIGNAL = 'reverse_selected_series';
export const REVERSE_UNSELECT_SIGNAL = 'reverse_unselect_signal';
export const TS_DOMAIN_SIGNAL = 'ts_domain_value';
export const EXTERNAL_TS_DOMAIN_SIGNAL = 'external_ts_domain_value';
export const INTERNAL_TS_DOMAIN_SIGNAL = 'internal_ts_domain_value';

function addHoverMarks(spec: VgSpec, dataName: string) {
  // Used by both HOVER_RULE, HOVER_LINE_TIME and HOVER_BULB.
  const hoverOpacityEncoding = [
    {
      test: `${HOVER_SIGNAL} && datum && (${HOVER_SIGNAL}["${TIME_FIELD}"] === datum["${TIME_FIELD}"])`,
      value: HOVER_LINE_OPACITY,
    },
    { value: 0 },
  ];
  // The bulb position.
  const bulbPositionSignal = { signal: `height + ${HOVER_BULB_OFFSET}` };

  // Add mark for vertical line where cursor is.
  addMark(spec, {
    name: HOVER_RULE,
    type: 'rule',
    style: ['rule'],
    interactive: true,
    from: { data: dataName },
    encode: {
      enter: {
        stroke: { value: HOVER_LINE_COLOR },
        strokeDash: { value: HOVER_LINE_DASH },
        strokeWidth: { value: HOVER_LINE_WIDTH },
      },
      update: {
        opacity: hoverOpacityEncoding,
        x: { scale: 'x', field: TIME_FIELD },
        y: { value: 0 },
        y2: { signal: `height + ${HOVER_LINE_TEXT_OFFSET}` },
      },
    },
  });
  // Bulb mark.
  addMark(spec, {
    name: HOVER_BULB,
    type: 'symbol',
    interactive: true,
    from: { data: dataName },
    encode: {
      enter: {
        fill: { value: HOVER_LINE_COLOR },
        stroke: { value: HOVER_LINE_COLOR },
        size: { value: 45 },
        shape: { value: 'circle' },
        strokeOpacity: { value: 0 },
        strokeWidth: { value: 2 },
      },
      update: {
        // fillOpacity: hoverOpacityEncoding,
        fillOpacity: { value: 0 },
        x: { scale: 'x', field: TIME_FIELD },
        y: bulbPositionSignal,
      },
    },
  });
  // Add mark for the text of the time at the bottom of the rule.
  const hoverLineTime = addMark(spec, {
    name: HOVER_LINE_TIME,
    type: 'text',
    from: { data: dataName },
    encode: {
      enter: {
        fill: { value: HOVER_TIME_COLOR },
        align: { value: 'center' },
        baseline: { value: 'top' },
        font: { value: 'Roboto' },
        fontSize: { value: 10 },
      },
      update: {
        opacity: hoverOpacityEncoding,
        text: { signal: `datum && timeFormat(datum["${TIME_FIELD}"], "%I:%M:%S")` },
        x: { scale: 'x', field: TIME_FIELD },
        y: { signal: `height + ${HOVER_LINE_TEXT_OFFSET} + ${HOVER_LINE_TEXT_PADDING}` },
      },
    },
  });
  // Add mark for fill box around time text.
  const hoverTimeBox = addMark(spec, {
    name: HOVER_LINE_TEXT_BOX,
    type: 'rect',
    from: { data: HOVER_LINE_TIME },
    encode: {
      update: {
        x: { signal: `datum.x - ((datum.bounds.x2 - datum.bounds.x1) / 2) - ${HOVER_LINE_TEXT_PADDING}` },
        y: { signal: `datum.y - ${HOVER_LINE_TEXT_PADDING}` },
        width: { signal: `datum.bounds.x2 - datum.bounds.x1 + 2 * ${HOVER_LINE_TEXT_PADDING}` },
        height: { signal: `datum.bounds.y2 - datum.bounds.y1 + 2 * ${HOVER_LINE_TEXT_PADDING}` },
        fill: { value: HOVER_LINE_COLOR },
        opacity: { signal: 'datum.opacity > 0 ? 1.0 : 0.0' },
      },
    },
    zindex: 0,
  });

  // Display text above text box.
  hoverLineTime.zindex = hoverTimeBox.zindex + 1;

  // Add mark for voronoi layer.
  addMark(spec, {
    name: HOVER_VORONOI,
    type: 'path',
    interactive: true,
    from: { data: HOVER_RULE },
    encode: {
      update: {
        fill: { value: 'transparent' },
        strokeWidth: { value: 0.35 },
        stroke: { value: 'transparent' },
        isVoronoi: { value: true },
      },
    },
    transform: [
      {
        type: 'voronoi',
        x: { expr: 'datum.datum.x || 0' },
        y: { expr: 'datum.datum.y || 0' },
        size: [{ signal: 'width' }, { signal: `height + ${AXIS_HEIGHT}` }],
      },
    ],
    zindex: VORONOI_Z_LAYER,
  });
}

function hydrateSpecWithTheme(spec: VgSpec, theme: Theme) {
  spec.background = theme.palette.background.default;
  spec.padding = theme.spacing(2);
  spec.config = {
    ...spec.config,
    legend: {
      // fillOpacity: 1,
      labelColor: theme.palette.foreground.one,
      labelFont: 'Roboto',
      labelFontSize: 10,
      padding: theme.spacing(1),
      symbolSize: 100,
      titleColor: theme.palette.foreground.one,
      titleFontSize: 12,
    },
    style: {
      bar: {
        // binSpacing: 2,
        fill: '#39A8F5',
        stroke: null,
      },
      cell: {
        stroke: 'transparent',
      },
      arc: {
        fill: '#39A8F5',
      },
      area: {
        fill: '#39A8F5',
      },
      line: {
        stroke: '#39A8F5',
        strokeWidth: 1,
      },
      symbol: {
        shape: 'circle',
      },
      rect: {
        fill: '#39A8F5',
      },
      'group-title': {
        fontSize: 0,
      },
      'grouped-bar-x-title': {
        fill: theme.palette.foreground.one,
        fontSize: 12,
      },
      'grouped-bar-x-subtitle': {
        fill: theme.palette.foreground.one,
        fontSize: 10,
      },
    },
    axis: {
      labelColor: theme.palette.foreground.one,
      labelFont: 'Roboto',
      labelFontSize: 10,
      labelPadding: theme.spacing(0.5),
      tickColor: theme.palette.foreground.grey4,
      tickSize: 10,
      tickWidth: 1,
      titleColor: theme.palette.foreground.one,
      titleFont: 'Roboto',
      titleFontSize: 12,
      // titleFontWeight: theme.typography.fontWeightRegular,
      titlePadding: theme.spacing(3),
    },
    axisY: {
      grid: true,
      domain: false,
      gridColor: theme.palette.foreground.grey4,
      gridWidth: 0.5,
    },
    axisX: {
      grid: false,
      domain: true,
      domainColor: theme.palette.foreground.grey4,
      tickOpacity: 0,
      tickSize: theme.spacing(0.5),
    },
    axisBand: {
      grid: false,
    },
    group: {
      fill: '#f0f0f0',
    },
    path: {
      stroke: '#39A8F5',
      strokeWidth: 0.5,
    },
    range: {
      category: [
        '#21a1e7',
        '#2ca02c',
        '#98df8a',
        '#aec7e8',
        '#ff7f0e',
        '#ffbb78',
      ],
      diverging: [
        '#cc0020',
        '#e77866',
        '#f6e7e1',
        '#d6e8ed',
        '#91bfd9',
        '#1d78b5',
      ],
      heatmap: [
        '#d6e8ed',
        '#cee0e5',
        '#91bfd9',
        '#549cc6',
        '#1d78b5',
      ],
    },
    shape: {
      stroke: '#39A8F5',
    },
  };
}

/* eslint-enable @typescript-eslint/no-use-before-define */
