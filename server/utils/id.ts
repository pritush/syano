const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function encodeTime(time: number, length: number) {
  let value = time
  let output = ''

  for (let index = 0; index < length; index += 1) {
    output = CROCKFORD[value % 32] + output
    value = Math.floor(value / 32)
  }

  return output
}

function encodeRandom(length: number) {
  let output = ''

  for (let index = 0; index < length; index += 1) {
    output += CROCKFORD[Math.floor(Math.random() * CROCKFORD.length)]
  }

  return output
}

export function generateId() {
  return `${encodeTime(Date.now(), 10)}${encodeRandom(16)}`
}

