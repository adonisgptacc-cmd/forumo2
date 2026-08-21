const defaultAlphabet =
  "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_QqFjkt1-_eN6g3LZ2s";

function generate(alphabet, size) {
  let id = "";
  for (let index = 0; index < size; index += 1) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

function nanoid(size = 21) {
  return generate(defaultAlphabet, size);
}

function customAlphabet(alphabet, defaultSize = 21) {
  return (size = defaultSize) => generate(alphabet, size);
}

module.exports = { customAlphabet, nanoid };
