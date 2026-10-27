/*
 * SAM continuous (SAMc) is an interactive animated pictorial assessment technique derived from the
 * original Self-Assessment Manikin (Bradley, and Lang, 1994). This JS module defines a custom HTML
 * element that renders SAMc on a webpage.
 *
 * First, load the module in the `head` of a HTML page:
 *
 *   <script type="module" src="sam-c.js"></script>
 *
 * Now you can use the `sam-c` element in the page body:
 *
 *   <sam-c valence="-0.43" arousal="0" dominance="1" animate></sam-c>
 *
 * The `valence`, `arousal` and `dominance` attributes can be set from -1 to 1 (valence goes from
 * negative to positive, arousal from low-energy to high-energy, and dominance from submissive to
 * dominant. Animation can be enabled and disabled usign the `animate` boolean attribute.
 */

// Returns the given value as a float if it is a number, and returns it unchanged otherwise.
function parseFloatIfNumber(value) {
  const float = parseFloat(value)
  return Number.isNaN(float) ? value : float
}

// Splits an SVG path definition string into an array so that all individual command parameter
// values are separate array elements. This doesn’t provide any meaningful parsing of the path
// definition syntax. The given value is returned unchanged when it is not a string.
function splitPath(path) {
  if (typeof path !== 'string') {
    return path
  }

  let inParam = false
  let previouslyInParam = false
  const elements = []
  let element = ''
  for (const char of path) {
    inParam = '-1234567890.'.includes(char)
    if (previouslyInParam !== inParam) {
      elements.push(parseFloatIfNumber(element))
      element = ''
    }
    element += char
    previouslyInParam = inParam
  }
  elements.push(parseFloatIfNumber(element))
  return elements
}

// Joins the given array to a string with all numbers rounded to 3 decimals.
function joinPath(array) {
  return array
    .map((element) => {
      if (typeof element === 'number') {
        element = +element.toFixed(3)
      }
      return element
    })
    .join('')
}

// Gets the `d` attribute when the given value is a path element, returns it unchanged otherwise.
function pathDefinition(path) {
  return typeof path.getAttribute === 'function' ? path.getAttribute('d') : path
}

// Returns a function that interpolates between the two given SVG path elements, path definition
// strings, or paths splitted into arrays. Both paths are assumed to contain the same commands and
// to differ only in terms of their parameter values.
//
// The interpolator returns the first path given 0, the second path given 1, and a linear
// interpolation between the two paths for any value in between. The interpolated path is returned
// as a path definition string by default, but can optionally be returned as an array for further
// processing.
function interpolator(from, to) {
  from = splitPath(pathDefinition(from))
  to = splitPath(pathDefinition(to))
  return (position, returnAsArray = false) => {
    const interpolated = from.map((element, index) => {
      if (typeof element === 'number') {
        element = element + (to[index] - element) * position
      }
      return element
    })
    return returnAsArray ? interpolated : joinPath(interpolated)
  }
}

// Returns the given array with all numbers randomly offset up to the given amount. Identical values
// are offset with the same amount. This allows SVG paths to get increasingly jittery without any
// jumps between the end and start point of a path.
function randomize(array, amount) {
  if (amount <= 0) {
    return array
  }

  const values = {}
  return array.map((element) => {
    if (typeof element === 'number') {
      if (values[element] === undefined) {
        values[element] = element + (Math.random() - 0.5) * amount
      }
      element = values[element]
    }
    return element
  })
}

// Define the custom element.
class SamC extends HTMLElement {
  // The emotional state dimensions can be changed and animation can be toggled.
  static get observedAttributes() {
    return [
      'valence', // Valence can be set from negative (-1) to positive (1).
      'arousal', // Arousal can be set from low-energy (-1) to high-energy (1).
      'dominance', // Dominance can be set from submissive (-1) to dominant (1).
      'animate', // The chest and the heart animate when the boolean animate attribute is present.
    ]
  }

  constructor() {
    super()

    // Emotional state dimensions.
    this.valence = 0
    this.arousal = 0
    this.dominance = 0

    // Keep track of the previous dominance value to alternate the eye direction when dominance
    // changes to submissive (from neutral or from dominant). Randomly choose the initial side.
    this.prev_dominance = 0
    this.submissive_side_glance = [0.75, -0.75][Math.round(Math.random())]

    // Body parts the human figure consists of.
    this.parts = {}

    // The phases of the chest breathing and the heartbeat animations go from 0 to 1.
    this.phase = {
      breath: 0,
      beat: 0,
    }

    // Create a wrapper div element and keep a reference so that it can be used to force a repaint
    // after updating the human figure.
    this.wrapper = document.createElement('div')

    // Add the SVG image of the human figure inside the wrapper div element.
    //
    // The human figure is highly schematized using mostly straight lines and right angles. It
    // has a rectangular hair shape, an upper body shape consisting of the arms, shoulders, and the
    // head, and a lower body shape consisting of the torso, legs, and feet. The hair shape remains
    // static, the upper and lower body shapes depend on the dominance.
    //
    // On the torso there’s a circle representing the chest that grows and shrinks in size
    // periodically to represent breathing. Within the chest there’s a heart shape consisting of a
    // left and right chamber which expand and contract rhythmically to repesent hearbeats. This
    // animations can be disabled. The speed of animation depends on the arousal.
    //
    // The head contains eyebrows, eyes, a nose, and a mouth. The nose remains static. The shape
    // and position of the eyebrows, eyes, and mouth depend on valence, arousal, and dominance.
    this.wrapper.innerHTML = `
      <svg width="100%" height="100%" viewBox="0 0 128 144" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5;">
      <rect id="hair" x="40" y="8" width="48" height="24" style="fill:white;stroke:black;stroke-width:1.5px;"/>
      <path id="upper_body" d="M32,80L16,80L16,50L48,50L48,16L80,16L80,50L112,50L112,80L96,80" style="fill:white;stroke:black;stroke-width:1.5px;"/>
      <path id="upper_body_submissive" d="M32,88L20,88L20,60L47.5,48L47.5,16L80.5,16L80.5,48L108,56L108,88L96,88" style="fill:white;stroke:black;stroke-width:1.5px;"/>
      <path id="upper_body_dominant" d="M32,80L16,80L15,47L48,48L48,15L80,15L80,48L113,47L112,80L96,80" style="fill:white;stroke:black;stroke-width:1.5px;"/>
      <path id="lower_body" d="M32,66L32,112L16,112L16,128L48,128L48,112L80,112L80,128L112,128L112,112L96,112L96,66" style="fill:white;stroke:black;stroke-width:1.5px;"/>
      <path id="lower_body_submissive" d="M32,70L32,112L24,112L24,128L56,128L56,113L72,113L72,128L104,128L104,112L96,112L96,70" style="fill:white;stroke:black;stroke-width:1.5px;"/>
      <path id="lower_body_dominant" d="M33,64L31,110L15,110L15,128L47,128L47,111L81,111L81,128L113,128L113,110L97,110L95,64" style="fill:white;stroke:black;stroke-width:1.5px;"/>
      <path id="chest" d="M64,64C66.923,64 69.664,64.687 72.023,65.887C76.791,68.312 80,72.831 80,78C80,81.837 78.232,85.316 75.371,87.845C72.47,90.41 68.446,92 64,92C57.92,92 52.628,89.026 49.921,84.652C48.696,82.673 48,80.407 48,78C48,74.762 49.259,71.778 51.373,69.405C54.301,66.117 58.87,64 64,64Z" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="chest_up" d="M64,60C68.501,60 72.656,61.341 76,63.603C80.857,66.888 84,72.116 84,78C84,83.347 81.404,88.152 77.286,91.45C73.752,94.28 69.097,96 64,96C56.762,96 50.417,92.532 46.906,87.343C45.062,84.619 44,81.42 44,78C44,73.315 45.993,69.046 49.256,65.843C52.914,62.252 58.167,60 64,60Z" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="nose" d="M62,34L62,35L66,35L66,34" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="mouth_negative" d="M56.023,47C58.023,39 70.023,39 72.023,47" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="mouth_negative_active" d="M56.023,47C58.023,46.002 70.023,45.961 72.023,47" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="mouth" d="M57,42C60,42.026 68,42.026 71,42" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="mouth_positive" d="M56,37C58.023,45 70,45 72.023,37" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="mouth_positive_active" d="M56,37C58.025,38.972 70.002,39.03 72.023,37" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="left_eye" d="M54,27L54,32L60,32L60,27" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="left_eye_active" d="M53.5,26L53.5,32L60,32L60,26" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="left_eyelid" d="M54,27L60,27" style="fill:none;stroke:black;stroke-width:1.5px;stroke-linecap:butt;"/>
      <path id="left_eyelid_active" d="M53.5,26L60,26" style="fill:none;stroke:black;stroke-width:1.5px;stroke-linecap:butt;"/>
      <circle id="left_pupil" cx="57.046" cy="29.5" r="1.25"/>
      <path id="right_eye" d="M68,27L68,32L74,32L74,27" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="right_eye_active" d="M68,26L68,32L74.5,32L74.5,26" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="right_eyelid" d="M68,27L74,27" style="fill:none;stroke:black;stroke-width:1.5px;stroke-linecap:butt;"/>
      <path id="right_eyelid_active" d="M68,26L74.5,26" style="fill:none;stroke:black;stroke-width:1.5px;stroke-linecap:butt;"/>
      <circle id="right_pupil" cx="71.046" cy="29.5" r="1.25"/>
      <path id="left_eyebrow" d="M54,24L59,24" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="left_eyebrow_submissive" d="M54,24.5L59,21.5" style="fill:none;stroke:rgb(255,0,0);stroke-width:1.5px;"/>
      <path id="left_eyebrow_dominant" d="M53.5,21L59,24" style="fill:none;stroke:rgb(255,0,237);stroke-width:1.5px;"/>
      <path id="right_eyebrow" d="M69,24L74,24" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="right_eyebrow_submissive" d="M69,21.5L74,24.5" style="fill:none;stroke:rgb(255,0,0);stroke-width:1.5px;"/>
      <path id="right_eyebrow_dominant" d="M69,24L74.5,21" style="fill:none;stroke:rgb(255,0,237);stroke-width:1.5px;"/>
      <path id="right_heart" d="M66.305,85.372C62.288,89.483 58.208,86.752 56,82.928C53.792,79.104 54.328,74.656 57.196,73C60.064,71.344 65.042,73.223 67.55,79.223" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="right_heart_contracted" d="M66.485,85.09C62.374,89.589 58.18,85.489 55.696,81.187C53.213,76.886 53.735,72.528 56.124,71.148C58.514,69.768 64.09,72.613 66.219,78.188" style="fill:none;stroke:black;stroke-width:1.5px;"/>
      <path id="left_heart" d="M64,76.781C65.349,74.666 67.338,73.76 69.33,74.294C71.995,75.008 73.347,78.618 72.348,82.35C71.348,86.081 67.491,89.699 64,86.813" style="fill:white;stroke:black;stroke-width:1.5px;"/>
      <path id="left_heart_contracted" d="M64.867,76.58C65.743,73.312 68.118,71.899 69.847,72.362C71.98,72.934 73.474,77.207 72.403,81.205C71.332,85.203 68.094,89.699 64.484,86.424" style="fill:white;stroke:black;stroke-width:1.5px;"/>
      </svg>
    `

    // Create a style element with the CSS needed to make the SVG image contain the element.
    const style = document.createElement('style')
    style.textContent = `
      div,
      svg
      {
        display: block;
        width: 100%;
        height: 100%;
      }
    `

    // Attach a shadow DOM tree and add the style and wrapper elements.
    const shadow = this.attachShadow({ mode: 'open' })
    shadow.appendChild(style)
    shadow.appendChild(this.wrapper)

    // Create an object with all SVG elements as values and their id attributes as names.
    const elements = {}
    this.wrapper.querySelectorAll('svg > *[id]').forEach((element) => {
      elements[element.getAttribute('id')] = element
    })

    // Add body part paths elements, interpolator functions, and other values.
    this.parts.mouth = {
      path: elements.mouth,
      negative: interpolator(elements.mouth, elements.mouth_negative),
      positive: interpolator(elements.mouth, elements.mouth_positive),
      negative_active: interpolator(elements.mouth, elements.mouth_negative_active),
      positive_active: interpolator(elements.mouth, elements.mouth_positive_active),
    }
    this.parts.mouth.clone = this.parts.mouth.path.parentNode.appendChild(
      this.parts.mouth.path.cloneNode(true),
    )
    this.parts.mouth.clone.id = 'mouth_clone'
    this.parts.mouth.clone.style.visibility = 'hidden'

    this.parts.eyebrows = [
      {
        path: elements.left_eyebrow,
        dominant: interpolator(elements.left_eyebrow, elements.left_eyebrow_dominant),
        submissive: interpolator(elements.left_eyebrow, elements.left_eyebrow_submissive),
      },
      {
        path: elements.right_eyebrow,
        dominant: interpolator(elements.right_eyebrow, elements.right_eyebrow_dominant),
        submissive: interpolator(elements.right_eyebrow, elements.right_eyebrow_submissive),
      },
    ]

    this.parts.eyes = [
      {
        path: elements.left_eye,
        active: interpolator(elements.left_eye, elements.left_eye_active),
      },
      {
        path: elements.right_eye,
        active: interpolator(elements.right_eye, elements.right_eye_active),
      },
    ]

    this.parts.eyelids = [
      {
        path: elements.left_eyelid,
        active: interpolator(elements.left_eyelid, elements.left_eyelid_active),
      },
      {
        path: elements.right_eyelid,
        active: interpolator(elements.right_eyelid, elements.right_eyelid_active),
      },
    ]

    this.parts.pupils = [
      {
        path: elements.left_pupil,
      },
      {
        path: elements.right_pupil,
      },
    ]
    this.parts.pupils.forEach((pupil, index) => {
      this.parts.pupils[index].r = parseFloat(pupil.path.getAttribute('r'))
      this.parts.pupils[index].x = parseFloat(pupil.path.getAttribute('cx'))
      this.parts.pupils[index].y = parseFloat(pupil.path.getAttribute('cy'))
    })

    this.parts.chest = {
      path: elements.chest,
      breathe: interpolator(elements.chest, elements.chest_up),
    }

    this.parts.heart = {
      left: {
        path: elements.left_heart,
        contract: interpolator(elements.left_heart, elements.left_heart_contracted),
      },
      right: {
        path: elements.right_heart,
        contract: interpolator(elements.right_heart, elements.right_heart_contracted),
      },
    }

    this.parts.body = [
      {
        path: elements.upper_body,
        submissive: interpolator(elements.upper_body, elements.upper_body_submissive),
        dominant: interpolator(elements.upper_body, elements.upper_body_dominant),
      },
      {
        path: elements.lower_body,
        submissive: interpolator(elements.lower_body, elements.lower_body_submissive),
        dominant: interpolator(elements.lower_body, elements.lower_body_dominant),
      },
    ]

    // Remove SVG elements used for interpolation that shouldn’t be displayed.
    ;[
      'mouth_negative',
      'mouth_positive',
      'mouth_negative_active',
      'mouth_positive_active',
      'left_eyebrow_dominant',
      'left_eyebrow_submissive',
      'right_eyebrow_dominant',
      'right_eyebrow_submissive',
      'left_eye_active',
      'left_eyelid_active',
      'right_eye_active',
      'right_eyelid_active',
      'chest_up',
      'left_heart_contracted',
      'right_heart_contracted',
      'upper_body_submissive',
      'upper_body_dominant',
      'lower_body_submissive',
      'lower_body_dominant',
    ].forEach((id) => {
      elements[id].remove()
    })
  }

  // The custom element is added to the page.
  connectedCallback() {
    // Add missing emotional state dimension attributes.
    ;['valence', 'arousal', 'dominance'].forEach((attribute) => {
      if (!this.hasAttribute(attribute)) {
        this.setAttribute(attribute, this[attribute])
      }
    })

    // Update body parts.
    this.update()
  }

  // Attributes of the custom element are changed, added, or removed.
  attributeChangedCallback(name, _oldValue, newValue) {
    if (name === 'animate') {
      // The `animate` attribute is changed.
      if (newValue == null) {
        window.cancelAnimationFrame(this.animation)
        this.animation = undefined
      } else if (this.animation === undefined) {
        this.animation = window.requestAnimationFrame(this.frame.bind(this))
      }
    } else if (['valence', 'arousal', 'dominance'].includes(name)) {
      // An emotional state dimension is changed.
      let value = parseFloat(newValue)
      if (Number.isNaN(value)) {
        value = 0
      } else if (value < -1) {
        value = -1
      } else if (value > 1) {
        value = 1
      }
      this[name] = value
      this.update()
    }
  }

  // Update body parts according to the current values of the emotional state dimensions.
  update() {
    // When valence is from neutral to positive, the eyebrows remain horizontal. The eyebrows are
    // also horizontal when dominance is neutral.
    //
    // When valence goes to negative, the angle of the eyebrows increases depending on the
    // dominance. When dominance goes to dominant, the eyebrows angle up increasingly to the
    // outside of the face, when dominance goes to submissive, the eyebrows angle up increasingly
    // to the nose.
    //
    // When dominance goes from neutral to dominant, the eyebrows also get slightly thicker.
    //
    // When arousal goes from neutral to high-energy, the eyebrows also move up with the eyes.
    this.parts.eyebrows.forEach((eyebrow) => {
      let position
      if (this.valence < 0) {
        position = Math.abs(this.dominance) * (Math.abs(this.valence) * 0.9 + 0.05)
      } else {
        position = 0
      }
      if (this.dominance < 0) {
        eyebrow.path.setAttribute('d', eyebrow.submissive(position))
        eyebrow.path.style.strokeWidth = '1.5px'
      } else {
        eyebrow.path.setAttribute('d', eyebrow.dominant(position))
        eyebrow.path.style.strokeWidth = `${1.5 + this.dominance / 2}px`
      }
    })
    if (this.arousal < 0) {
      this.parts.eyebrows.forEach((eyebrow) => {
        eyebrow.path.setAttribute('transform', 'none')
      })
    } else {
      this.parts.eyebrows.forEach((eyebrow) => {
        eyebrow.path.setAttribute('transform', `translate(0, ${this.arousal ** 2 * -2.5})`)
      })
    }

    // When valence is neutral, the mouth is a straight line. When valence goes to negative, the
    // mouth curves down, when valence goes to positive, the mouth curves up.
    //
    // When arousal goes from neutral to high-energy, the mouth opens up for positive valence, and
    // opens down for negative valence.
    //
    // Also, when dominance goes to dominant, the mouth gets slightly wider and bigger, and when
    // dominance goes to submissive, the mouth gets slightly narrower and smaller.
    let pathInterpolated
    let cloneInterpolated
    if (this.valence < 0) {
      pathInterpolated = this.parts.mouth.negative(Math.abs(this.valence), true)
      cloneInterpolated = this.parts.mouth.negative_active(Math.abs(this.valence), true)
    } else {
      pathInterpolated = this.parts.mouth.positive(this.valence, true)
      cloneInterpolated = this.parts.mouth.positive_active(this.valence, true)
    }
    const mouthInterpolator = interpolator(pathInterpolated, cloneInterpolated)
    this.parts.mouth.path.setAttribute('d', joinPath(pathInterpolated))
    if (this.arousal > 0) {
      this.parts.mouth.clone.setAttribute('d', mouthInterpolator(Math.abs(this.arousal)))
      this.parts.mouth.clone.style.visibility = 'visible'
    } else {
      this.parts.mouth.clone.style.visibility = 'hidden'
    }

    const scale = 1 + this.dominance * 0.1
    const x = (1 - scale) * 64
    const y = (1 - scale) * 42
    const width = 1.5 * (1 / scale)
    this.parts.mouth.path.setAttribute('transform', `translate(${x}, ${y}) scale(${scale})`)
    this.parts.mouth.path.style.strokeWidth = `${width}px`
    this.parts.mouth.clone.setAttribute('transform', `translate(${x}, ${y}) scale(${scale})`)
    this.parts.mouth.clone.style.strokeWidth = `${width}px`

    // When arousal goes from neutral to low-energy, the upper eyelid moves down. When arousal goes
    // from neutral to high-energy, the eyes get slightly bigger.
    if (this.arousal < 0) {
      this.parts.eyes.forEach((eye) => {
        eye.path.setAttribute('d', eye.active(0))
      })

      this.parts.eyelids.forEach((eyelid) => {
        eyelid.path.setAttribute('transform', `translate(0, ${this.arousal ** 2 * 2.5})`)
        eyelid.path.setAttribute('d', eyelid.active(0))
      })
    } else {
      this.parts.eyes.forEach((eye) => {
        eye.path.setAttribute('d', eye.active(this.arousal))
      })

      this.parts.eyelids.forEach((eyelid) => {
        eyelid.path.setAttribute('transform', 'none')
        eyelid.path.setAttribute('d', eyelid.active(this.arousal))
      })
    }

    // The size of the pupils depend on arousal, valence, and dominance. They get smaller when
    // valence goes to negative and when arousal goes to low-energy, and bigger when valence goes
    // to positive and when arousal goes to high-energy.
    //
    // When valence is negative, the pupils get smaller when dominance goes from neutral (both to
    // submissive as well as to dominant). When valence is positive, the pupils get bigger when
    // dominance goes from neutral (both to submissive as well as to dominant).
    //
    // When valence goes from neutral to negative, the pupils move down. The pupils also move down
    // with the eyelids when arousal goes from neutral to low-energy.
    //
    // When dominance goes from neutral to submissive, the pupils glance increasingly to the left
    // or right side. The side they glance to alternates every time dominance goes from dominant or
    // neutral to submissive. The initial side is randomly chosen (in the constructor above).
    this.parts.pupils.forEach((pupil, index) => {
      let size
      if (this.arousal < 0) {
        size = this.arousal
      } else {
        size = this.arousal * 0.5
      }
      size += this.valence * 0.25
      size += Math.sign(this.valence) * Math.abs(this.valence) * Math.abs(this.dominance) * 0.5

      let x = 0
      if (this.arousal > 0) {
        x = this.arousal * [-0.25, 0.25][index]
      }
      if (this.prev_dominance > 0 && this.dominance < 0) {
        this.submissive_side_glance *= -1
      }
      if (this.prev_dominance !== this.dominance) {
        this.prev_dominance = this.dominance
      }
      if (this.dominance < 0) {
        x += this.dominance * this.submissive_side_glance
      }

      let y
      if (this.arousal < 0) {
        y = this.arousal ** 2 * 1.25
      } else {
        y = this.arousal * -0.5
      }

      let verticalGlance = 0
      if (this.valence < 0) {
        verticalGlance = this.valence * 0.5
      }

      pupil.path.setAttribute('r', pupil.r + size * 0.25)
      pupil.path.setAttribute('cx', pupil.x + x)
      pupil.path.setAttribute('cy', pupil.y + (y - verticalGlance * (1.5 - y)))
    })

    // When dominance goes from neutral to dominant, the height of the face increases, the shoulders
    // angle up and widen, and the feet get bigger and move to the outside, widening the stance of
    // the figure.
    //
    // When dominance goes from neutral to submissive, the face gets widerm the shoulders angle down
    // and narrow, and the feet move to the inside, narrowing the stance of the figure.
    if (this.dominance < 0) {
      this.parts.body.forEach((bodypart) => {
        bodypart.path.setAttribute('d', bodypart.submissive(Math.abs(this.dominance)))
      })
    } else {
      this.parts.body.forEach((bodypart) => {
        bodypart.path.setAttribute('d', bodypart.dominant(this.dominance))
      })
    }

    // Force repaint to prevent artifacts when the SVG is displayed as a flexbox.
    this.wrapper.style.display = 'none'
    this.wrapper.offsetHeight
    this.wrapper.style.display = 'block'
  }

  // When arousal goes from neutral to low-energy, the speed of the breathing chest and beating
  // heart animations decrease. When arousal goes from neutral to high-energy, the speed of these
  // animations increases.
  //
  // The breathing chest animation goes from 7.5 breaths per minute at low-energy, to 20 breaths
  // per minute at neutral, to 100 breaths per minute at high-energy arousal.
  //
  // The beating heart animation goes from 50 beats per minute at low-energy, to 80 beats
  // per minute at neutral, to 250 beats per minute at high-energy arousal.
  //
  // When arousal goes from neutral to high-energy, increasing random variation is added to the
  // shapes, making the animation appear increasingly “jittery”.
  frame(timestamp) {
    const delta = this.prev_timestamp === undefined ? 0 : timestamp - this.prev_timestamp

    const jitter = this.arousal > 0.5 ? (this.arousal * 2 - 1) * 0.55 : 0

    const breathsPerMinute = 20 + this.arousal * (this.arousal < 0 ? 12.5 : 80)
    this.phase.breath = (this.phase.breath + delta / ((60 / breathsPerMinute) * 1000)) % 1
    const breathPhaseInRadians = this.phase.breath * Math.PI * 2
    const breathSharpness = 1 - this.dominance * 0.25
    const breathDepth = 0.25 + ((1 - this.arousal) / 2) * 0.5 + ((this.dominance + 1) / 2) * 0.25
    const breathPosition =
      (1 -
        (1 -
          (0.5 + 0.5 * Math.sin(breathPhaseInRadians + 0.25 * Math.sin(breathPhaseInRadians)))) **
          breathSharpness) *
      breathDepth
    this.parts.chest.path.setAttribute(
      'd',
      joinPath(randomize(this.parts.chest.breathe(breathPosition, true), jitter)),
    )

    const beatsPerMinute = 80 + this.arousal * (this.arousal < 0 ? 30 : 170)
    this.phase.beat = (this.phase.beat + delta / ((60 / beatsPerMinute) * 1000)) % 1
    const beatPhaseInRadians = this.phase.beat * Math.PI * 2
    const beatDepth = 0.3 + (this.arousal + 1) * 0.1
    const leftBeatPosition = (1 - (0.5 + 0.5 * Math.sin(beatPhaseInRadians))) ** 4 * beatDepth
    this.parts.heart.left.path.setAttribute(
      'd',
      joinPath(randomize(this.parts.heart.left.contract(leftBeatPosition, true), jitter)),
    )
    const rightBeatPosition = (1 - (0.5 + 0.5 * Math.sin(beatPhaseInRadians + 1))) ** 6 * beatDepth
    this.parts.heart.right.path.setAttribute(
      'd',
      joinPath(randomize(this.parts.heart.right.contract(rightBeatPosition, true), jitter)),
    )

    this.prev_timestamp = timestamp
    this.animation = window.requestAnimationFrame(this.frame.bind(this))
  }
}

// Register the custom element.
customElements.define('sam-c', SamC)
