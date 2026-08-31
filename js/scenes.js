/* ---------------------------------------------------------------------------
   THE ONLY FILE YOU NEED TO EDIT TO CHANGE THE WORDS.

   Each scene has:
     id      the image file name stem  ->  img/<id>_rpca.jpg and img/<id>_src.jpg
     answer  the option that is actually correct
     others  three plausible alternatives, chosen to be believable given the
             colours of the reduced image rather than obviously wrong
     reveal  what is shown after the person answers
     place   the small grey line under it (leave "" to hide it)

   The options are shuffled on screen, so the correct one is not always first.
   Keep options to three or four words: they are read at arm's length, in a
   dark room, by someone who has been standing for six hours.
--------------------------------------------------------------------------- */

export const SCENES = [
  {
    id: 'bangkok',
    answer: 'Dense greenery',
    others: ['Moss and stone', 'A garden pond', 'A shaded courtyard'],
    reveal: 'A planted garden path',
    place: 'Bangkok, Thailand',
  },
  {
    id: 'fireworks',
    answer: 'Fireworks at night',
    others: ['A night harbour', 'Deep water', 'A lit stage'],
    reveal: 'A summer fireworks festival',
    place: 'Japan',
  },
  {
    id: 'fuji',
    answer: 'A lake below a mountain',
    others: ['Open farmland', 'A wide beach', 'A river delta'],
    reveal: 'Mount Fuji from the lake shore',
    place: 'Yamanashi, Japan',
  },
  {
    id: 'hamburg',
    answer: 'A harbour front',
    others: ['A glass tower', 'A winter shoreline', 'An industrial yard'],
    reveal: 'The Elbphilharmonie at low sun',
    place: 'Hamburg, Germany',
  },
  {
    id: 'hiyoshi',
    answer: 'Autumn trees',
    others: ['A desert canyon', 'A field of rapeseed', 'A tiled courtyard'],
    reveal: 'Ginkgo trees on campus',
    place: 'Hiyoshi, Keio University',
  },
  {
    id: 'river',
    answer: 'A street along a river',
    others: ['A hillside village', 'A quarry', 'A wide estuary'],
    reveal: 'A riverside street',
    place: 'Japan',
  },
  {
    id: 'sasazuka',
    answer: 'A shopping street',
    others: ['A festival at night', 'A market hall', 'A rooftop view'],
    reveal: 'A shopping street under lanterns',
    place: 'Sasazuka, Tokyo',
  },
  {
    id: 'shinjuku',
    answer: 'Neon at night',
    others: ['A cave interior', 'A forest at night', 'A lava field'],
    reveal: 'Shinjuku after dark',
    place: 'Tokyo, Japan',
  },
  {
    id: 'sunset',
    answer: 'Sea at sunset',
    others: ['A desert at dusk', 'A misty valley', 'A sandstorm'],
    reveal: 'Sunset over the sea',
    place: '',
  },
  {
    id: 'weimar',
    answer: 'An old town street',
    others: ['A stone quarry', 'A snowy roofscape', 'A gravel riverbed'],
    reveal: 'The old town',
    place: 'Weimar, Germany',
  },
];
