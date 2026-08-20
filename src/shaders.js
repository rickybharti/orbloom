export const vertexShaderSource = `
attribute vec2 aPosition;
attribute vec2 aTextureCoord;
varying vec2 vUv;

void main() {
  vUv = aTextureCoord;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const fragmentShaderSource = `
precision highp float;

varying vec2 vUv;
uniform vec2 uResolution;
uniform vec3 uInteriorColor;
uniform vec3 uBaseColor;
uniform vec3 uAccentPrimary;
uniform vec3 uAccentSecondary;
uniform vec3 uAccentHighlight;
uniform float uTime;
uniform float uSeed;
uniform float uAudioBrightness;
uniform float uAudioPulse;
uniform float uSpin;
uniform float uArchetype;
uniform float uGlass;
uniform float uVisualIntensity;
uniform float uDetail;
uniform float uGlow;
uniform float uState;
uniform float uStateBlend;

float scalarHash(float value) {
  return fract(sin(value * 127.1) * 43758.5453);
}

vec4 sampleSky(vec3 direction, float time) {
  float longitude = atan(direction.z, direction.x);
  float latitude = asin(clamp(direction.y, -1.0, 1.0));
  float varianceA = fract(uSeed * 7.13);
  float varianceB = fract(uSeed * 3.71);
  float varianceC = fract(uSeed * 5.37);

  float type = uArchetype >= 0.0 ? uArchetype : floor(fract(uSeed * 9.73) * 4.0);
  float nebulaType = step(0.5, type) * (1.0 - step(1.5, type));
  float coreType = step(1.5, type) * (1.0 - step(2.5, type));
  float deepType = step(2.5, type);

  float planeOffset = latitude
    + (0.15 + 0.4 * varianceA) * sin(longitude * (1.0 + floor(varianceB * 2.0)) + 1.3)
    + 0.12 * sin(longitude * 3.0 + time * 0.1);
  float band = exp(-planeOffset * planeOffset * (5.0 + 10.0 * varianceC));
  band = mix(band, max(band, 0.8), nebulaType);
  band *= 1.0 - 0.85 * deepType;

  float waveA = sin(longitude * 2.0 + sin(latitude * 3.0 + time * 0.25) * 1.6 + time * 0.15);
  float waveB = sin(longitude * 5.0 - sin(latitude * 4.0 - time * 0.2) * 1.2 - time * 0.22 + 2.4);
  float cloud = pow(0.5 + 0.5 * waveA, 2.0) * (0.45 + 0.55 * pow(0.5 + 0.5 * waveB, 2.0));
  float dustLane = pow(0.5 + 0.5 * sin(longitude * 4.0 + latitude * 7.0 + sin(longitude * 2.0) * 2.0), 3.0);
  float galaxy = clamp(band * cloud * (1.0 - dustLane * (0.55 + 0.35 * varianceB)), 0.0, 1.0);

  vec3 paletteHue = mix(
    mix(uAccentPrimary, uAccentSecondary, varianceA),
    mix(uAccentSecondary, uAccentHighlight, varianceC),
    0.5 + 0.5 * sin(longitude + latitude * 2.0 - time * 0.2)
  );
  vec3 greyHue = vec3(dot(paletteHue, vec3(0.299, 0.587, 0.114)));
  paletteHue = clamp(greyHue + (paletteHue - greyHue) * 1.45, 0.0, 1.0);
  vec3 dustColor = mix(vec3(0.72, 0.78, 0.92), paletteHue, 0.45 + 0.3 * varianceA + 0.45 * nebulaType);
  vec3 color = dustColor * galaxy * (0.6 + 0.9 * nebulaType);

  float shear = sin(longitude * 13.0 + latitude * 4.0 - time * 0.35)
    * sin(longitude * 5.0 + time * 0.2);
  color += dustColor * band * cloud * max(shear, 0.0) * 0.14;

  float secondPlane = latitude - (0.35 + 0.25 * varianceB) * sin(longitude * 2.0 - 1.1) + 0.4;
  float secondArm = exp(-secondPlane * secondPlane * 7.0) * cloud;
  color += mix(dustColor, uAccentSecondary, 0.35) * secondArm * 0.2;

  vec3 ambientColor = mix(
    vec3(0.04, 0.03, 0.1),
    mix(uAccentPrimary, mix(uAccentSecondary, uAccentHighlight, varianceC), varianceA) * 0.22,
    0.75
  );
  color += ambientColor * (0.5 + 0.22 * sin(time * 0.4 + longitude)) * (0.4 + 0.6 * band);
  color += vec3(1.0, 0.88, 0.68) * pow(band, 4.0) * pow(cloud, 2.0) * 0.4;

  float coreAngle = varianceB * 6.28318;
  vec3 coreDirection = normalize(vec3(cos(coreAngle) * 0.85, 0.6 * (varianceC - 0.5), sin(coreAngle) * 0.85));
  float bulge = max(dot(direction, coreDirection), 0.0);
  color += mix(vec3(1.0, 0.85, 0.6), uAccentHighlight, 0.25)
    * (pow(bulge, 14.0) * 1.6 + pow(bulge, 4.0) * 0.5) * coreType;

  float pocketA = pow(cloud, 5.0) * band * (0.7 + 0.3 * sin(time * 0.6 + longitude * 3.0));
  color += mix(uAccentHighlight, uAccentPrimary, fract(varianceA + 0.5 * sin(longitude * 2.0) + 0.5))
    * pocketA * (0.5 + 0.4 * varianceB + 0.8 * nebulaType);
  float pocketB = pow(0.5 + 0.5 * sin(longitude * 3.0 + latitude * 4.0 - time * 0.18 + 2.0), 6.0) * band;
  color += mix(uAccentSecondary, uAccentHighlight, varianceC) * pocketB * (0.25 + 0.3 * varianceA + 0.5 * nebulaType);

  float detail = smoothstep(90.0, 200.0, uResolution.y) * uDetail;
  vec2 grainGrid = vec2(longitude, latitude) * 34.0;
  vec2 grainCell = floor(grainGrid);
  vec2 grainLocal = fract(grainGrid);
  float grainHash = scalarHash(grainCell.x * 3.7 + grainCell.y * 11.3);
  vec2 grainPoint = vec2(
    0.2 + 0.6 * scalarHash(grainHash * 91.0),
    0.2 + 0.6 * scalarHash(grainHash * 47.0)
  );
  float grainDistance = length((grainLocal - grainPoint) * vec2(cos(latitude), 1.0));
  float resolutionFactor = clamp(uResolution.y / 420.0, 0.22, 1.0);
  float grain = exp(-grainDistance * grainDistance * 700.0 * resolutionFactor)
    * step(0.3, grainHash) * (0.15 + 0.85 * band);
  color += vec3(0.88, 0.9, 1.0) * grain * 0.4 * detail;
  float coverage = clamp(galaxy * 0.7 + pow(band, 4.0) * 0.25, 0.0, 1.0);

  for (int scaleIndex = 0; scaleIndex < 3; scaleIndex++) {
    float scale = scaleIndex == 0 ? 6.0 : (scaleIndex == 1 ? 11.0 : 19.0);
    vec2 grid = vec2(longitude, latitude) * scale;
    vec2 cell = floor(grid);
    vec2 local = fract(grid);
    float hashX = scalarHash(cell.x * 13.7 + cell.y * 7.3 + float(scaleIndex) * 91.0);
    float hashY = scalarHash(cell.x * 5.1 + cell.y * 17.9 + float(scaleIndex) * 37.0);
    vec2 starPoint = vec2(0.15 + 0.7 * hashX, 0.15 + 0.7 * hashY);
    float distanceToStar = length((local - starPoint) * vec2(cos(latitude), 1.0));
    float census = (varianceB - 0.5) * 0.2 + 0.35 * nebulaType - 0.2 * coreType + 0.3 * deepType;
    float threshold = scaleIndex == 2 ? 0.3 : 0.55;
    float keep = step(threshold + census, scalarHash(hashX * 89.0 + hashY * 31.0) + band * 0.25);
    float twinkle = mix(
      0.92,
      0.6 + 0.4 * sin(time * (1.5 + 3.0 * hashX) + hashX * 40.0),
      resolutionFactor
    );
    float sizeHash = scalarHash(hashX * 53.0 + hashY * 71.0 + cell.x);
    float magnitude = 0.35 + 1.8 * sizeHash * sizeHash;
    float sharpness = (scaleIndex == 0 ? 260.0 : (scaleIndex == 1 ? 700.0 : 1600.0))
      / magnitude * resolutionFactor;
    float star = exp(-distanceToStar * distanceToStar * sharpness) * keep * twinkle;
    vec3 temperature = hashX < 0.33
      ? vec3(0.85, 0.9, 1.0)
      : (hashX < 0.66 ? vec3(1.0, 0.95, 0.85) : mix(vec3(1.0), uAccentSecondary, 0.3));
    vec3 tint = mix(vec3(1.0), temperature, 0.6);
    float brightness = (scaleIndex == 0 ? 1.7 : (scaleIndex == 1 ? 0.9 : 0.5))
      * (0.55 + 0.7 * magnitude);
    float scaleFade = mix(scaleIndex == 2 ? 0.14 : 0.45, 1.0, detail);
    color += tint * star * brightness * scaleFade;

    if (scaleIndex == 0) {
      float largeStar = smoothstep(1.2, 2.0, magnitude);
      color += tint * exp(-distanceToStar * distanceToStar * 60.0) * 0.18 * largeStar * twinkle * scaleFade;
      vec2 offset = (local - starPoint) * vec2(cos(latitude), 1.0);
      float spike = exp(-offset.x * offset.x * 1200.0) * exp(-offset.y * offset.y * 26.0)
        + exp(-offset.y * offset.y * 1200.0) * exp(-offset.x * offset.x * 26.0);
      color += tint * spike * 0.3 * largeStar * twinkle * scaleFade;
      coverage = max(coverage, spike * 0.3 * largeStar * scaleFade);
    }
    coverage = max(coverage, star * min(brightness, 1.5) * scaleFade);
  }

  float pulsarAngle = varianceA * 6.28318;
  vec3 pulsarDirection = normalize(vec3(
    sin(pulsarAngle) * 0.9,
    1.4 * (varianceB - 0.5),
    cos(pulsarAngle) * 0.9
  ));
  float pulsarAlignment = max(dot(direction, pulsarDirection), 0.0);
  float pulse = pow(0.5 + 0.5 * sin(time * (1.2 + varianceC + 1.5 * uAudioPulse) + varianceC * 6.28), 8.0);
  pulse = min(1.0, pulse + 0.6 * uAudioPulse);
  float pulsarFade = mix(0.45, 1.0, detail);
  color += vec3(0.9, 0.95, 1.0)
    * (pow(pulsarAlignment, 900.0) * (0.6 + 1.2 * pulse) + pow(pulsarAlignment, 110.0) * 0.5 * pulse)
    * pulsarFade;
  coverage = max(coverage, pow(pulsarAlignment, 900.0) * (0.5 + 0.5 * pulse) * pulsarFade);
  return vec4(min(color, vec3(1.0)), min(coverage, 1.0));
}

vec4 sampleRotatedSphere(vec3 direction, float spin, float time) {
  float roll = time * 0.13;
  float rollCos = cos(roll);
  float rollSin = sin(roll);
  direction = vec3(
    rollCos * direction.x - rollSin * direction.y,
    rollSin * direction.x + rollCos * direction.y,
    direction.z
  );
  float tilt = 0.45 + 0.35 * sin(time * 0.24);
  float tiltCos = cos(tilt);
  float tiltSin = sin(tilt);
  direction = vec3(
    direction.x,
    tiltCos * direction.y - tiltSin * direction.z,
    tiltSin * direction.y + tiltCos * direction.z
  );
  float spinCos = cos(spin);
  float spinSin = sin(spin);
  direction = vec3(
    spinCos * direction.x + spinSin * direction.z,
    direction.y,
    -spinSin * direction.x + spinCos * direction.z
  );
  return sampleSky(direction, time);
}

vec3 shadeOrb(vec2 point) {
  float radius = length(point);
#ifdef COMPACT_ORB
  if (radius > 1.0) discard;
#endif
  float clampedRadius = min(radius, 0.9995);
  float depth = sqrt(1.0 - clampedRadius * clampedRadius);
  vec3 normal = vec3(point.x, point.y, depth);
  float rim = pow(1.0 - depth, 2.4);

  vec3 refracted = refract(vec3(0.0, 0.0, -1.0), normal, 0.75);
  float backDistance = -2.0 * dot(normal, refracted);
  vec3 backDirection = normalize(normal + refracted * backDistance);

  float time = uTime * 0.8 + uSeed;
  float varianceA = fract(uSeed * 6.31);
  float varianceB = fract(uSeed * 2.17);
  float warpedTime = time
    + (0.9 + 1.3 * varianceA) * sin(time * (0.09 + 0.07 * varianceB))
    + (0.5 + 0.8 * varianceB) * sin(time * (0.21 + 0.09 * varianceA) + 2.6);
  vec4 front = sampleRotatedSphere(normal, uSpin, warpedTime);
#ifdef COMPACT_ORB
  vec4 back = vec4(0.0);
#else
  vec4 back = sampleRotatedSphere(backDirection, uSpin, warpedTime * 0.8 + 2.7);
#endif

  vec3 voidColor = mix(uBaseColor * 0.04, uBaseColor * 0.35, rim);
  vec3 color = mix(uInteriorColor, voidColor, 0.97 - 0.04 * rim);
  float frontAlpha = clamp(front.a, 0.0, 1.0);
  float backAlpha = clamp(back.a, 0.0, 1.0);
  color = mix(color, back.rgb, backAlpha * 0.16);
  color = mix(color, front.rgb, frontAlpha * 0.85);

  float auroraLongitude = atan(normal.x, normal.z);
  float speechWave = pow(
    0.5 + 0.5 * sin(auroraLongitude * 3.0 + sin(auroraLongitude * 7.0 + time * 1.1) * 0.7 + time * 0.5),
    3.0
  ) * (0.55 + 0.45 * sin(auroraLongitude * 5.0 - time * 0.65 + 1.7));
  float visibleSky = -normal.y;
  float hangingMask = smoothstep(-0.15, 0.5, visibleSky);
  float rayPattern = 0.7 + 0.3 * sin(
    auroraLongitude * 24.0 + sin(auroraLongitude * 9.0 - time * 0.8) * 2.0 + time * 1.6
  );
  float aurora = clamp(speechWave, 0.0, 1.0) * hangingMask * rayPattern * (1.0 + 2.2 * uAudioPulse);
  float auroraVariance = fract(uSeed * 2.93);
  vec3 auroraColor = mix(
    vec3(0.12, 0.95, 0.55),
    vec3(0.45, 0.35, 1.0),
    smoothstep(0.0, 0.95, visibleSky + 0.35 * speechWave)
  );
  auroraColor = mix(auroraColor, mix(uAccentPrimary, uAccentHighlight, auroraVariance), 0.15 + 0.4 * auroraVariance);
  color += auroraColor * aurora * 0.8;

  float meteorPeriod = 4.5 + 3.5 * fract(uSeed * 4.91);
  float meteorEpoch = floor(time / meteorPeriod);
  float meteorPhase = fract(time / meteorPeriod);
  vec2 meteorStart = vec2(
    -1.1 + 2.2 * scalarHash(meteorEpoch * 1.3),
    0.85 - 1.4 * scalarHash(meteorEpoch * 2.9)
  );
  vec2 meteorDirection = normalize(vec2(
    0.7 + 0.5 * scalarHash(meteorEpoch * 4.1),
    -0.35 - 0.4 * scalarHash(meteorEpoch * 5.3)
  ));
  vec2 meteorHead = meteorStart + meteorDirection * meteorPhase * 2.8;
  vec2 meteorRelative = point - meteorHead;
  float meteorAlong = dot(meteorRelative, meteorDirection);
  float meteorPerpendicular = dot(meteorRelative, vec2(-meteorDirection.y, meteorDirection.x));
  float meteorVisible = smoothstep(0.0, 0.06, meteorPhase) * smoothstep(0.5, 0.32, meteorPhase);
  float meteorTail = exp(-meteorPerpendicular * meteorPerpendicular * 1600.0)
    * exp(meteorAlong * 9.0) * step(meteorAlong, 0.0) * smoothstep(-0.5, -0.02, meteorAlong);
  float meteorGlow = exp(-dot(meteorRelative, meteorRelative) * 900.0);
  color += (vec3(1.0) * meteorGlow * 1.2 + mix(vec3(1.0), uAccentSecondary, 0.3) * meteorTail * 0.85)
    * meteorVisible;

  vec3 movingLight = normalize(vec3(
    0.85 * sin(time * 0.42),
    0.45 * sin(time * 0.26 + 1.2),
    0.5
  ));
  float diffuse = (0.62 + 0.65 * max(dot(normal, movingLight), 0.0)) * (1.0 + 0.35 * uAudioBrightness);
  color *= diffuse;
  vec3 voiceColor = mix(uAccentSecondary, vec3(1.0, 0.97, 0.9), 0.45);
  color += voiceColor * pow(1.0 - clampedRadius, 1.8) * uAudioBrightness * 0.5;
  color += (uAccentSecondary * 0.7 + vec3(0.12)) * rim * uAudioBrightness * 0.65 * uGlow;
  color += color * uAudioBrightness * 0.18 * sin(time * 14.0 + clampedRadius * 40.0 + uSeed * 7.0);
  float counterLight = max(dot(normal.xy, -movingLight.xy), 0.0) * rim;
  color += mix(uAccentPrimary, vec3(0.5, 0.6, 0.9), 0.5) * counterLight * 0.18 * uGlow;

  vec3 keyDirection = normalize(vec3(
    -0.45 + 0.3 * sin(time * 0.34),
    0.62 + 0.2 * sin(time * 0.27 + 1.7),
    0.64
  ));
  float keyStrength = 0.5 * (0.78 + 0.22 * sin(time * 0.45 + 2.2));
  color += vec3(1.0) * pow(max(dot(normal, keyDirection), 0.0), 150.0) * keyStrength * uGlow;
  vec3 sheenDirection = normalize(vec3(sin(time * 0.07) * 0.9, 0.35 + 0.3 * cos(time * 0.05), 0.7));
  color += vec3(1.0) * pow(max(dot(normal, sheenDirection), 0.0), 7.0) * 0.05 * uGlow;
  vec3 glintDirection = normalize(vec3(0.52, -0.5 + 0.12 * sin(time * 0.09), 0.69));
  color += vec3(1.0) * pow(max(dot(normal, glintDirection), 0.0), 140.0) * 0.25 * uGlow;
  color = mix(color, front.rgb, frontAlpha * rim * 0.3);
  float listeningState = step(0.5, uState) * (1.0 - step(1.5, uState));
  float thinkingState = step(1.5, uState) * (1.0 - step(2.5, uState));
  float successState = step(3.5, uState) * (1.0 - step(4.5, uState));
  float errorState = step(4.5, uState);
  float statePulse = 0.5 + 0.5 * sin(time * (1.1 + thinkingState * 0.7));
  float stateStrength = uStateBlend * (
    listeningState * 0.12
    + thinkingState * (0.08 + 0.1 * statePulse)
    + successState * 0.22
    + errorState * 0.18
  );
  vec3 stateColor = mix(uAccentPrimary, uAccentSecondary, thinkingState * statePulse);
  stateColor = mix(stateColor, uAccentHighlight, successState);
  stateColor = mix(stateColor, vec3(1.0, 0.08, 0.05), errorState);
  color += stateColor * (0.15 + 0.85 * rim) * stateStrength * uGlow;
  color *= uVisualIntensity;
  float limb = smoothstep(0.94, 1.0, clampedRadius);
  return mix(color, color * 0.85, limb * 0.4);
}

void main() {
  vec2 point = vUv * 2.0 - 1.0;
  if (length(point) > 1.0) discard;
  if (uGlass > 0.0) {
    float radius = length(point);
    float exponential = exp(2.0 * 1.7724539 * (radius - 0.9) / 0.1414214);
    float edgeFalloff = 0.5 + 0.5 * (exponential - 1.0) / (exponential + 1.0);
    if (edgeFalloff > 0.004) {
      float lensPulse = 1.0 + 0.16 * (
        0.6 * sin(uTime * 0.9 + uSeed)
        + 0.4 * sin(uTime * 1.7 + uSeed * 1.3)
      );
      float displacement = uGlass * edgeFalloff * lensPulse;
      float redShift = 1.4 * (1.0 + 0.06 * sin(uTime * 1.3 + uSeed));
      float greenShift = 1.2 * (1.0 + 0.06 * sin(uTime * 1.3 + uSeed + 2.1));
      float blueShift = 1.0 * (1.0 + 0.06 * sin(uTime * 1.3 + uSeed + 4.2));
      vec3 color = vec3(
        shadeOrb(point * (1.0 - displacement * redShift)).r,
        shadeOrb(point * (1.0 - displacement * greenShift)).g,
        shadeOrb(point * (1.0 - displacement * blueShift)).b
      );
      vec2 absolutePoint = min(abs(point), 1.0);
      float lobe = max(
        abs(absolutePoint.x * 0.766 + absolutePoint.y * 0.643),
        abs(absolutePoint.x * 0.766 - absolutePoint.y * 0.643)
      );
      float glow = 0.65 * pow(clamp((lobe - 0.0707) / 1.3435, 0.0, 1.0), 2.4) * edgeFalloff;
      glow += 1.02 * clamp(1.0 + (radius - 1.0) / 0.15, 0.0, 1.0)
        * step(radius, 1.0) * pow(lobe, 2.0);
      color += vec3(0.25) * min(glow, 1.0) * uGlow;
      gl_FragColor = vec4(color, 1.0);
      return;
    }
  }
  gl_FragColor = vec4(shadeOrb(point), 1.0);
}
`;

export const compactFragmentShaderSource = fragmentShaderSource.replace(
  "precision highp float;",
  "precision highp float;\n#define COMPACT_ORB",
);
