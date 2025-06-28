import React, { useState } from 'react';
import { parse } from 'svgson';
import makerjs from 'makerjs';

function App() {
  const [svgJson, setSvgJson] = useState(null);

  // SVG file input handler
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const json = await parse(text);
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

  const argsToPoints = (args) => {
    if (!args || args.length < 2) return [];
    return args.reduce((acc, val, index) => {
      if (index % 2 === 0) {
        acc.push([val, args[index + 1]]);
      }
      return acc;
    }, []);
  };

  const argsToPointsRelative = (args, currentPoint) => {
    if (!args || args.length < 2) return [];
    return args.reduce((acc, val, index) => {
      if (index % 2 === 0) {
        acc.push([currentPoint[0] + val, currentPoint[1] + args[index + 1]]);
      }
      return acc;
    }, []);
  };

  const getLastPoint = (args) => {
    if (!args || args.length < 2) return null;
    return [args[args.length - 2], args[args.length - 1]];
  };

  const getLastPointRelative = (args, currentPoint) => {
    if (!args || args.length < 2) return null;
    return [currentPoint[0] + args[args.length - 2], currentPoint[1] + args[args.length - 1]];
  };

  const convertPathToInstructions = (path) => {
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
        // Reconstruct the command string for debugging
        const commandString = type + args.join(' ');
        // ...switch/case logic as before, but use 'type', 'args', and 'commandString'...
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
              points: argsToPoints(args),
            });
            currentPoint = getLastPoint(args);
            break;
          case 'Q':
            instructions.push({
              command: commandString, argCount: args.length, 
              type: 'quadratic',
              points: argsToPoints(args),
            });
            currentPoint = getLastPoint(args);
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
            currentPoint = getLastPoint(args);
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
            currentPoint = getLastPoint(args);
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
              points: argsToPointsRelative(args, currentPoint),
            });
            currentPoint = getLastPointRelative(args, currentPoint);
            break;
          case 'q': // Quadratic Bezier curve (relative)
            instructions.push({
              command: commandString, argCount: args.length, 
              type: 'quadratic',
              points: argsToPointsRelative(args, currentPoint),
            });
            currentPoint = getLastPointRelative(args, currentPoint);
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
            currentPoint = getLastPointRelative(args, currentPoint);
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
            currentPoint = getLastPointRelative(args, currentPoint);
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
            currentPoint = getLastPointRelative(args, currentPoint);
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
    const match = transformString.match(/translate\(([^)]+)\)/);
    if (match) {
      const [x, y] = match[1].split(',').map(Number);
      transform.translate = { x, y };
    }
    const scaleMatch = transformString.match(/scale\(([^)]+)\)/);
    if (scaleMatch) {
      const [sx, sy] = scaleMatch[1].split(',').map(Number);
      transform.scale = { x: sx, y: sy || sx }; // If sy is not provided, assume uniform scaling
    }
    const rotateMatch = transformString.match(/rotate\(([^)]+)\)/);
    if (rotateMatch) {
      const angle = parseFloat(rotateMatch[1]);
      transform.rotate = angle;
    }
    const skewXMatch = transformString.match(/skewX\(([^)]+)\)/);
    if (skewXMatch) {
      const angle = parseFloat(skewXMatch[1]);
      transform.skewX = angle;
    }
    const skewYMatch = transformString.match(/skewY\(([^)]+)\)/);
    if (skewYMatch) {
      const angle = parseFloat(skewYMatch[1]);
      transform.skewY = angle;
    }
    const matrixMatch = transformString.match(/matrix\(([^)]+)\)/);
    if (matrixMatch) {
      const matrixValues = matrixMatch[1].split(',').map(Number);
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
            svgData.attributes.d.replace(/(?<![eE])-/g, ' -')
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
          x: svgData.attributes.x,
          y: svgData.attributes.y,
          width: svgData.attributes.width,
          height: svgData.attributes.height,
          fill: svgData.attributes.fill,
          stroke: svgData.attributes.stroke,
          strokeWidth: svgData.attributes['stroke-width'],
        };
      case 'circle':
        return {
          type: 'circle',
          transform: extractTransform(svgData.attributes.transform),
          cx: svgData.attributes.cx,
          cy: svgData.attributes.cy,
          r: svgData.attributes.r,
          fill: svgData.attributes.fill,
          stroke: svgData.attributes.stroke,
          strokeWidth: svgData.attributes['stroke-width'],
        };
      default:
        return null;
    }
  }

  const svgObject = parseSvgStructure(svgJson);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <label>
          Load SVG:&nbsp;
          <input type="file" accept=".svg" onChange={handleFileChange} />
        </label>
        {svgJson && (
          <pre style={{ background: '#f0f0f0', marginTop: 16, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(svgObject, null, 2)}
          </pre>
        )}
      </div>
      {/* <div dangerouslySetInnerHTML={{ __html: svg }} /> */}
    </div>
  );
}

export default App;