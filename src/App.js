import React, { useState } from 'react';
import { parse } from 'svgson';
import makerjs from 'makerjs';
import { Container, Stage, Graphics } from '@pixi/react'

function App() {
  const [svgJson, setSvgJson] = useState(null);

  // SVG file input handler
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const json = await parse(text);
    console.log("SVG: " + JSON.stringify(json, null, 5));
    setSvgJson(json);
  };

  // const panelDimensions = {
  //   width: 350,
  //   height: 194,
  // };

  // // Combine both squares into a parent model
  // const stage = {
  //   models: {
  //     panel: {
  //       models: {
  //         cut: new makerjs.models.Rectangle(panelDimensions.width, panelDimensions.height),
  //         rbb: {
  //           models: {
  //             rbb1: new makerjs.models.Rectangle(100, 50),
  //             buttons: {
  //               paths: {
  //                 button1: new makerjs.paths.Circle([100/2 - 24, 50/2], 12),
  //                 button2: new makerjs.paths.Circle([100/2 + 24, 50/2], 12),
  //               },
  //               origin: [0, 0],
  //             }
  //           },
  //           origin: [(panelDimensions.width/2 - 50) - 100, panelDimensions.height/2 - 25],
  //         },
  //         lbb: {
  //           models: {
  //             lbb1: new makerjs.models.Rectangle(100, 50),
  //             buttons: {
  //               paths: {
  //                 button1: new makerjs.paths.Circle([100/2 - 24, 50/2], 12),
  //                 button2: new makerjs.paths.Circle([100/2 + 24, 50/2], 12),
  //               },
  //               origin: [0, 0],
  //             }
  //           },
  //           origin: [(panelDimensions.width/2 - 50) + 100, panelDimensions.height/2 - 25],
  //         }
  //       },
  //       paths: {
  //         hole1: new makerjs.paths.Circle([15, 15], 3),
  //         hole2: new makerjs.paths.Circle([15, 179], 3),
  //         hole3: new makerjs.paths.Circle([335, 15], 3),
  //         hole4: new makerjs.paths.Circle([335, 179], 3),
  //         hole5: new makerjs.paths.Circle([175, 6], 3),
  //         hole6: new makerjs.paths.Circle([175, 179 + 9], 3),
  //       },
  //       origin: [100, 100],
  //     }
  //   },
  //   units: makerjs.unitType.Millimeter,
  // };

  // // makerjs.path.moveRelative(group, [100, 100]);

  // console.log('Stage:', JSON.stringify(stage, null, 2));

  // // Export the model to SVG
  // const svg = makerjs.exporter.toSVG(stage);

  const argsToPoints = (args, transform) => {
    if (!args || args.length < 2) return [];
    return args.reduce((acc, val, index) => {
      if (index % 2 === 0) {
        acc.push([val, args[index + 1]]);
      }
      return acc;
    }, []);
  };

  const argsToPointsRelative = (args, currentPoint, transform) => {
    if (!args || args.length < 2) return [];
    return args.reduce((acc, val, index) => {
      if (index % 2 === 0) {
        acc.push([currentPoint[0] + val, currentPoint[1] + args[index + 1]]);
      }
      return acc;
    }, []);
  };

  const getLastPoint = (args, transform) => {
    if (!args || args.length < 2) return null;
    return [args[args.length - 2], args[args.length - 1]];
  };

  const getLastPointRelative = (args, currentPoint, transform) => {
    if (!args || args.length < 2) return null;
    return [currentPoint[0] + args[args.length - 2], currentPoint[1] + args[args.length - 1]];
  };

  const convertPathToInstructions = (path, transform) => {
    if (!path) return null;
    const instructions = [];
    // Tokenize: match commands or numbers (including exponents)
    const tokens = path.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
    if (!tokens) return null;
    let currentPoint = [0, 0];
    let i = 0;
    while (i < tokens.length) {
      const type = tokens[i++];
      if (!/[a-zA-Z]/.test(type)) continue;
      // Number of arguments per command type
      const argCounts = {
        M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7,
        m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7,
        Z: 0, z: 0
      };

      if ((type === 'z' || type === 'Z') && i >= tokens.length) {
        instructions.push({ command: 'z', argCount: 0, type: 'close' });
      }

      const argsNeeded = argCounts[type];
      // Some commands can have multiple sets of arguments (e.g., "C" with 12 numbers = 2 segments)
      while (i < tokens.length) {
        // Stop if next token is a command
        if (/[a-zA-Z]/.test(tokens[i])) break;
        const args = [];
        for (let j = 0; j < argsNeeded && i < tokens.length; j++) {
          args.push(Number(tokens[i++]));
        }
        if (args.length < argsNeeded) break;
        const commandString = type + args.join(' ');
        switch (type) {
          case 'M':
            currentPoint = [args[0], args[1]];
            instructions.push({ command: commandString, argCount: args.length, type: 'move', point: currentPoint });
            break;
          case 'L':
            currentPoint = [args[0], args[1]];
            instructions.push({ command: commandString, argCount: args.length, type: 'line', point: currentPoint });
            break;
          case 'C':
            instructions.push({
              command: commandString, argCount: args.length, 
              type: 'bezier',
              points: argsToPoints(args, transform),
            });
            currentPoint = getLastPoint(args, transform);
            break;
          case 'Q':
            instructions.push({
              command: commandString, argCount: args.length, 
              type: 'quadratic',
              points: argsToPoints(args, transform),
            });
            currentPoint = getLastPoint(args, transform);
            break;
          case 'A': // Arc
            const rx = args[0], ry = args[1], xAxisRotation = args[2],
                  largeArcFlag = args[3], sweepFlag = args[4],
                  x = args[5], y = args[6];
            instructions.push({
              command: commandString, argCount: args.length, 
              type: 'arc',
              rx,
              ry,
              xAxisRotation,
              largeArcFlag,
              sweepFlag,
              point: [x, y],
            });
            currentPoint = [x, y];
            break;
          case 'H': // Horizontal line to
            currentPoint[0] = args[0];
            instructions.push({ command: commandString, argCount: args.length, type: 'line', point: currentPoint });
            break;
          case 'V': // Vertical line to
            currentPoint[1] = args[0];
            instructions.push({ command: commandString, argCount: args.length, type: 'line', point: currentPoint });
            break;
          case 'S': // Smooth cubic Bezier curve
            const prevCommand = instructions[instructions.length - 1];
            const prevControlPoint = prevCommand && prevCommand.type === 'bezier' ? prevCommand.points[1] : currentPoint;
            const controlPoint = [currentPoint[0] + (currentPoint[0] - prevControlPoint[0]), currentPoint[1] + (currentPoint[1] - prevControlPoint[1])];
            instructions.push({
              command: commandString, argCount: args.length, 
              type: 'absolute',
              points: [
                controlPoint,
                [args[0], args[1]],
                [args[2], args[3]],
              ],
            });
            currentPoint = getLastPoint(args, transform);
            break;
          case 'T': // Smooth quadratic Bezier curve
            const prevQuadCommand = instructions[instructions.length - 1];
            const prevQuadControlPoint = prevQuadCommand && prevQuadCommand.type === 'quadratic' ? prevQuadControlPoint.points[0] : currentPoint;
            const quadControlPoint = [currentPoint[0] + (currentPoint[0] - prevQuadControlPoint[0]), currentPoint[1] + (currentPoint[1] - prevQuadControlPoint[1])];
            instructions.push({
              command: commandString, argCount: args.length, 
              type: 'quadratic',
              points: [
                quadControlPoint,
                [args[0], args[1]],
              ],
            });
            currentPoint = getLastPoint(args, transform);
            break;
          case 'm': // Move to (relative)
            currentPoint = [currentPoint[0] + args[0], currentPoint[1] + args[1]];
            instructions.push({ command: commandString, argCount: args.length, type: 'move', point: currentPoint });
            break;
          case 'l': // Line to (relative)
            currentPoint = [currentPoint[0] + args[0], currentPoint[1] + args[1]];
            instructions.push({ command: commandString, argCount: args.length, type: 'line', point: currentPoint });
            break;
          case 'c': // Cubic Bezier curve (relative)
            instructions.push({
              command: commandString, argCount: args.length, 
              type: 'bezier',
              points: argsToPointsRelative(args, currentPoint, transform),
            });
            currentPoint = getLastPointRelative(args, currentPoint, transform);
            break;
          case 'q': // Quadratic Bezier curve (relative)
            instructions.push({
              command: commandString, argCount: args.length, 
              type: 'quadratic',
              points: argsToPointsRelative(args, currentPoint, transform),
            });
            currentPoint = getLastPointRelative(args, currentPoint,transform);
            break;
          case 'a': // Arc (relative)
            const relRx = args[0], relRy = args[1], relXAxisRotation = args[2],
                  relLargeArcFlag = args[3], relSweepFlag = args[4],
                  relX = currentPoint[0] + args[5], relY      = currentPoint[1] + args[6];
            instructions.push({
              command: commandString, argCount: args.length, 
              type: 'arc',
              rx: relRx,
              ry: relRy,
              xAxisRotation: relXAxisRotation,
              largeArcFlag: relLargeArcFlag,
              sweepFlag: relSweepFlag,
              point: [relX, relY],
            });
            currentPoint = getLastPointRelative(args, currentPoint, transform);
            break;
          case 'h': // Horizontal line to (relative)
            currentPoint[0] += args[0];
            instructions.push({ command: commandString, argCount: args.length, type: 'line', point: currentPoint });
            break;
          case 'v': // Vertical line to (relative)
            currentPoint[1] += args[0];
            instructions.push({ command: commandString, argCount: args.length, type: 'line', point: currentPoint });
            break;
          case 's': // Smooth cubic Bezier curve (relative)
            const prevBezierCommand = instructions[instructions.length - 1];
            const prevBezierControlPoint = prevBezierCommand && prevBezierCommand.type === 'bezier' ? prevBezierCommand.points[1] : currentPoint;
            const relControlPoint = [currentPoint[0] + (currentPoint[0] - prevBezierControlPoint[0]), currentPoint[1] + (currentPoint[1] - prevBezierControlPoint[1])];
            instructions.push({
              command: commandString, argCount: args.length, 
              type: 'bezier',
              points: [
                relControlPoint,
                [currentPoint[0] + args[0], currentPoint[1] + args[1]],
                [currentPoint[0] + args[2], currentPoint[1] + args[3]],
              ],
            });
            currentPoint = getLastPointRelative(args, currentPoint, transform);
            break;
          case 't': // Smooth quadratic Bezier curve (relative)
            const prevQuadBezierCommand = instructions[instructions.length - 1];
            const prevQuadBezierControlPoint = prevQuadBezierCommand && prevQuadBezierCommand.type === 'quadratic' ? prevQuadBezierCommand.points[0] : currentPoint;
            const relQuadControlPoint = [currentPoint[0] + (currentPoint[0] - prevQuadBezierControlPoint[0]), currentPoint[1] + (currentPoint[1] - prevQuadBezierControlPoint[1])];
            instructions.push({
              command: commandString, argCount: args.length, 
              type: 'quadratic',
              points: [
                relQuadControlPoint,
                [currentPoint[0] + args[0], currentPoint[1] + args[1]],
              ],
            });
            currentPoint = getLastPointRelative(args, currentPoint, transform);
            break;
          case 'Z': // Close path
          case 'z':
            instructions.push({ command: commandString, argCount: args.length, type: 'close' });
            break;
          default:
            instructions.push({ type: 'unknown', command: commandString, argCount: args.length });
            break;
        }
        // For commands that can repeat (like "C", "L", etc.), loop continues
        // For commands that should not repeat, break after one
        if (!'MLHVCSQTAmlhvcsqta'.includes(type)) break;
      }
    }
    return instructions;
  }

  const extractViewBox = (viewBox) => {
    if (!viewBox) return null;
    const [x, y, width, height] = viewBox.split(' ').map(Number);
    return { x, y, width, height };
  };

  const convertMatrixToTransform = (matrix) => {
    if (!matrix) return null;
    return {
      skewX: Math.atan2(matrix.c, matrix.d) * (180 / Math.PI), // Convert radians to degrees
      skewY: Math.atan2(matrix.b, matrix.a), // Convert radians to degrees
      translate: { x: matrix.e, y: matrix.f },
      scale: { x: matrix.a, y: matrix.d },
      rotate: Math.atan2(matrix.b, matrix.a) * (180 / Math.PI), // Convert radians to degrees
    };
  }

  const extractTransform = (transformString) => {
    if (!transformString) return null;
    let transform = {};
    // translate
    const match = transformString.match(/translate\(([^)]+)\)/);
    if (match) {
      const [x, y] = match[1].trim().split(/[\s,]+/).map(Number);
      transform.translate = { x, y: y || 0 };
    }
    // scale
    const scaleMatch = transformString.match(/scale\(([^)]+)\)/);
    if (scaleMatch) {
      const [sx, sy] = scaleMatch[1].trim().split(/[\s,]+/).map(Number);
      transform.scale = { x: sx, y: sy !== undefined ? sy : sx };
    }
    // rotate
    const rotateMatch = transformString.match(/rotate\(([^)]+)\)/);
    if (rotateMatch) {
      const [angle, cx, cy] = rotateMatch[1].trim().split(/[\s,]+/).map(Number);
      transform.rotate = angle;
      if (cx !== undefined && cy !== undefined) {
        transform.rotateCenter = { x: cx, y: cy };
      }
    }
    // skewX
    const skewXMatch = transformString.match(/skewX\(([^)]+)\)/);
    if (skewXMatch) {
      const angle = parseFloat(skewXMatch[1]);
      transform.skewX = angle;
    }
    // skewY
    const skewYMatch = transformString.match(/skewY\(([^)]+)\)/);
    if (skewYMatch) {
      const angle = parseFloat(skewYMatch[1]);
      transform.skewY = angle;
    }
    // matrix
    const matrixMatch = transformString.match(/matrix\(([^)]+)\)/);
    if (matrixMatch) {
      const matrixValues = matrixMatch[1].trim().split(/[\s,]+/).map(Number);
      if (matrixValues.length === 6) {
        transform = {
          ...transform,
          ...convertMatrixToTransform({
            a: matrixValues[0],
            b: matrixValues[1],
            c: matrixValues[2],
            d: matrixValues[3],
            e: matrixValues[4],
            f: matrixValues[5],
          })
        };
      }
    }
    return transform;
  };

  const parseSvgStructure = (svgData) => {
    if (!svgData) return null;

    const { name, children } = svgData;

    switch (name) {
      case 'svg':
        return {
          header: {
            viewBox: extractViewBox(svgData.attributes.viewBox),
            width: svgData.attributes.width,
            height: svgData.attributes.height,
          },
          children: children.map(parseSvgStructure).filter((child) => child !== null),
        };
      case 'g':
        return {
          type: 'group',
          transform: extractTransform(svgData.attributes.transform),
          children: children.map(parseSvgStructure).filter((child) => child !== null),
        };
      case 'path':
        return {
          type: 'path',
          transform: extractTransform(svgData.attributes.transform),
          d: svgData.attributes.d.replace(/(?<![eE])-/g, ' -'),
          instructions: convertPathToInstructions(
            svgData.attributes.d.replace(/(?<![eE])-/g, ' -'),
            extractTransform(svgData.attributes.transform)
          ),
          fill: svgData.attributes.fill,
          stroke: svgData.attributes.stroke,
          strokeWidth: svgData.attributes['stroke-width'],
        };
      case 'rect':
        return {
          type: 'rectangle',
          transform: extractTransform(svgData.attributes.transform),
          attributes: svgData.attributes,
          x: Number(svgData.attributes.x),
          y: Number(svgData.attributes.y),
          rx: Number(svgData.attributes.rx),
          ry: Number(svgData.attributes.ry),
          width: Number(svgData.attributes.width),
          height: Number(svgData.attributes.height),
          fill: svgData.attributes.fill,
          stroke: svgData.attributes.stroke,
          strokeWidth: svgData.attributes['stroke-width'],
        };
      case 'circle':
        return {
          type: 'circle',
          transform: extractTransform(svgData.attributes.transform),
          cx: Number(svgData.attributes.cx),
          cy: Number(svgData.attributes.cy),
          r: Number(svgData.attributes.r),
          fill: svgData.attributes.fill,
          stroke: svgData.attributes.stroke,
          strokeWidth: svgData.attributes['stroke-width'],
        };
      default:
        return null;
    }
  }

  const drawPath = (g, instructions) => {
    g.clear();
    g.lineStyle(2, 0x000000, 1);
    let subpathStart = null;

    instructions?.forEach(({ type, points, point, rx, ry, xAxisRotation, largeArcFlag, sweepFlag }) => {
      if (type === 'move') {
        g.moveTo(point[0], point[1]);
        subpathStart = [point[0], point[1]];
      } else if (type === 'line') {
        g.lineStyle(2, 0x000000, 1);
        g.lineTo(point[0], point[1]);
      } else if (type === 'quadratic') {
        if (!points || points.length !== 2) return;
        g.moveTo(points[0][0], points[0][1]);
        g.lineStyle(2, 0x000000, 1);
        g.quadraticCurveTo(
          points[1][0], points[1][1],
          points[2][0], points[2][1]
        );
      } else if (type === 'bezier') {
        if (!points || points.length !== 3) return;
        g.lineStyle(2, 0x000000, 1);
        g.bezierCurveTo(
          points[0][0], points[0][1],
          points[1][0], points[1][1],
          points[2][0], points[2][1]
        );
      } else if (type === 'arc') {
        // Unimplemented
      } else if (type === 'close') {
        if (subpathStart) {
          g.lineTo(subpathStart[0], subpathStart[1]);
        }
      }
    });
  }

  const drawEllipticalRoundedRect = (g, x, y, width, height, rx, ry) => {
    g.clear();
    g.lineStyle(2, 0x000000, 1);

    // Ensure rx and ry are numbers and do not exceed half width/height
    const _rx = Math.min(Number(rx) || 0, width / 2);
    const _ry = Math.min(Number(ry) || 0, height / 2);

    if (!_rx && !_ry) {
      g.drawRect(x, y, width, height);
      return;
    }

    // Start at top-left corner, after the horizontal radius
    g.moveTo(x + _rx, y);

    // Top edge
    g.lineTo(x + width - _rx, y);

    // Top-right corner (elliptical arc)
    g.arc(
      x + width - _rx, y + _ry,
      _rx, Math.PI * 1.5, 0, false
    );

    // Right edge
    g.lineTo(x + width, y + height - _ry);

    // Bottom-right corner (elliptical arc)
    g.arc(
      x + width - _rx, y + height - _ry,
      _rx, 0, Math.PI * 0.5, false
    );

    // Bottom edge
    g.lineTo(x + _rx, y + height);

    // Bottom-left corner (elliptical arc)
    g.arc(
      x + _rx, y + height - _ry,
      _rx, Math.PI * 0.5, Math.PI, false
    );

    // Left edge
    g.lineTo(x, y + _ry);

    // Top-left corner (elliptical arc)
    g.arc(
      x + _rx, y + _ry,
      _rx, Math.PI, Math.PI * 1.5, false
    );
  }

  const renderModelTree = (modelTree) => {
    if (!modelTree) {
      return null;
    }

    let graphicsToDraw = [];

    const { type, instructions, children, transform, r, cx, cy, x, y, rx, ry, width, height } = modelTree;

    if (type === 'path') {
      graphicsToDraw.push(
        <Graphics
          draw={(g) => drawPath(g, instructions)}
        />
      );
    } else if (type === 'circle') {
      graphicsToDraw.push(
        <Graphics
          draw={(g) => {
            g.clear();
            g.lineStyle(2, 0x000000, 1);
            g.drawCircle(cx, cy, r);
          }}
        />
      );
    } else if (type === 'rectangle') {
      graphicsToDraw.push(
        <Graphics
          draw={(g) => {
            g.clear();
            g.lineStyle(2, 0x000000, 1);
            drawEllipticalRoundedRect(g, x, y, width, height, rx, ry);
          }}
        />
      );
    }

    if (children) {
      children.forEach((child) => {
        graphicsToDraw = [...graphicsToDraw, renderModelTree(child)];
      })
    }

    return (
      <Container x={transform?.translate?.x || 0} y={transform?.translate?.y || 0} scale={{ x: transform?.scale?.x || 1, y: transform?.scale?.y || 1 }}>
        {graphicsToDraw}
      </Container>
    )
  }

  const svgObject = parseSvgStructure(svgJson);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <label>
          Load SVG:&nbsp;
          <input type="file" accept=".svg" onChange={handleFileChange} />
        </label>
        <Stage
          width={svgObject?.header.viewBox.width * 2 || 1}
          height={svgObject?.header.viewBox.height * 2 || 1}
          options={{ backgroundColor: 0xffffff }}
        >
          <Container
            x={-svgObject?.header.viewBox.x + 10 || 0}
            y={-svgObject?.header.viewBox.y + 10 || 0}
          >
            {renderModelTree(svgObject)}
          </Container>
        </Stage>
        {svgJson && (
          <pre style={{ background: '#f0f0f0', marginTop: 16, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(svgObject, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export default App;