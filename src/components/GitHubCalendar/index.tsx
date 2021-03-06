import React, { useState, CSSProperties, useEffect, useCallback } from 'react';
import format from 'date-fns/format';
import parseISO from 'date-fns/parseISO';
import getYear from 'date-fns/getYear';
import { ColorInput } from 'tinycolor2';

import styles from './styles.css';

import {
  DEFAULT_THEME,
  LINE_HEIGHT,
  MIN_DISTANCE_MONTH_LABELS,
  NAMESPACE,
  TITLE_SCALE_FACTOR,
  Theme,
} from '../../utils/constants';
import { usePrevious } from '../../hooks/usePrevious';
import { getGitHubGraphData, GraphData, Block } from '../../services/contributions';
import { createCalendarTheme, getClassName } from '../../utils';

export type Props = {
  gitHubUsername: string;
  gitlabUsername?: string;
  blockSize?: number;
  blockMargin?: number;
  color?: ColorInput;
  dateFormat?: string;
  fontSize?: number;
  fullYear?: boolean;
  style?: CSSProperties;
  theme?: Theme;
  years?: number[];
};

const GitHubCalendar: React.FC<Props> = ({
  blockSize = 10,
  blockMargin = 4,
  children,
  color = undefined,
  dateFormat = 'MMM d, yyyy',
  fontSize = 14,
  fullYear = true,
  theme = undefined,
  gitHubUsername,
  gitlabUsername,
  style = {},
  years = [Number(format(new Date(), 'yyyy'))],
}) => {
  const [graphs, setGraphs] = useState<GraphData[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const prevYears = usePrevious(years);
  const prevUsername = usePrevious(gitHubUsername);
  const prevFullYear = usePrevious(fullYear);

  const fetchData = useCallback(() => {
    setError(null);
    getGitHubGraphData({
      years,
      gitHubUsername: gitHubUsername,
      gitLabUsername: gitlabUsername,
      fullYear,
    })
      .then(graphs => setGraphs(graphs))
      .catch((error: Error) => setError(error));
  }, [years, gitHubUsername, fullYear]);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line

  // Refetch if relevant props change
  useEffect(() => {
    if (
      prevFullYear !== fullYear ||
      prevUsername !== gitHubUsername ||
      prevYears.some(y => !years.includes(y))
    ) {
      fetchData();
    }
  }, [fetchData, fullYear, prevFullYear, prevUsername, prevYears, gitHubUsername, years]);

  function getTheme(): Theme {
    if (theme) {
      return Object.assign({}, DEFAULT_THEME, theme);
    }

    if (color) {
      return createCalendarTheme(color);
    }

    return DEFAULT_THEME;
  }

  function getDimensions() {
    const textHeight = Math.round(fontSize * LINE_HEIGHT);

    // Since weeks start on Sunday, there is a good chance that the graph starts
    // in the week before January 1st. Therefore, the calendar shows 53 weeks.
    const width = (52 + 1) * (blockSize + blockMargin) - blockMargin;
    const height = textHeight + (blockSize + blockMargin) * 7 - blockMargin;

    return { width, height };
  }

  function getTooltipMessage(day: Required<Block>) {
    const date = parseISO(day.date);
    return `<strong>${day.info.count} contributions</strong> on ${format(date, dateFormat)}`;
  }

  function renderTitle() {
    const style = {
      borderBottom: `2px solid ${getTheme().grade0}`,
      fontSize: `${Math.round(fontSize * TITLE_SCALE_FACTOR)}px`,
    };

    return (
      <div className={getClassName('title', styles.title)} style={style}>
        {!!gitHubUsername && (
          <a
            href={`https://github.com/${gitHubUsername}`}
            title="GitHub profile"
            style={{ color: 'inherit' }}
          >
            @{gitHubUsername} on GitHub
          </a>
        )}
        {!!gitHubUsername && !!gitlabUsername && ' & '}
        {!!gitlabUsername && (
          <a
            href={`https://gitlab.com/users/${gitlabUsername}`}
            title="GitHub profile"
            style={{ color: 'inherit' }}
          >
            @{gitlabUsername} on GitLab
          </a>
        )}
      </div>
    );
  }

  function renderMonthLabels(monthLabels: GraphData['monthLabels']) {
    const style = {
      fill: getTheme().text,
      fontSize,
    };

    // Remove the first month label if there's not enough space to the next one
    // (end of previous month)
    if (monthLabels[1].x - monthLabels[0].x <= MIN_DISTANCE_MONTH_LABELS) {
      monthLabels.shift();
    }

    return monthLabels.map(month => (
      <text x={(blockSize + blockMargin) * month.x} y={fontSize} key={month.x} style={style}>
        {month.label}
      </text>
    ));
  }

  function renderBlocks(blocks: GraphData['blocks']) {
    const theme = getTheme();
    const textHeight = Math.round(fontSize * LINE_HEIGHT);

    return blocks
      .map(week =>
        week.map((day, y) => (
          <rect
            x="0"
            y={textHeight + (blockSize + blockMargin) * y}
            width={blockSize}
            height={blockSize}
            fill={theme[`grade${day.info ? day.info.intensity : 0}`]}
            data-tip={day.info ? getTooltipMessage(day as Required<Block>) : null}
            key={day.date}
            rx="2"
            ry="2"
            style={{
              outlineColor: 'rgba(27,31,35,.04)',
              outlineStyle: 'solid',
              outlineWidth: 1,
              shapeRendering: 'geometricPrecision',
              outlineOffset: -1,
            }}
          />
        )),
      )
      .map((week, x) => (
        <g key={x} transform={`translate(${(blockSize + blockMargin) * x}, 0)`}>
          {week}
        </g>
      ));
  }

  function renderMeta(year: number, totalCount: number) {
    const isCurrentYear = getYear(new Date()) === year;

    return (
      <div className={getClassName('meta')} style={{ fontSize }}>
        {isCurrentYear && fullYear ? 'Last year' : year}
        {' – '}
        {isCurrentYear && !fullYear ? 'So far ' : null}
        {totalCount} contributions
      </div>
    );
  }

  const { width, height } = getDimensions();

  if (error) {
    console.error(error);
    return <p>Error :(</p>;
  }

  if (!graphs) {
    return <div className={getClassName('loading', styles.loading)}>Loading …</div>;
  }

  return (
    <article className={NAMESPACE} style={style}>
      {renderTitle()}
      {graphs.map(graph => {
        const { year, blocks, monthLabels, totalCount } = graph;

        return (
          <div key={year} className={getClassName('chart', styles.chart)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              className={getClassName('calendar', styles.calendar)}
              style={{ backgroundColor: theme?.background }}
            >
              {renderMonthLabels(monthLabels)}
              {renderBlocks(blocks)}
            </svg>

            {renderMeta(year, totalCount)}
            {children}
          </div>
        );
      })}
    </article>
  );
};

export default GitHubCalendar;
