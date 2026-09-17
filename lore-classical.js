// Short, source-linked summaries of Greek, Egyptian, Mesopotamian and Norse accounts.
// Each dossier names the textual or material witness; faction-lore.js adds the realm notes.
const src = (id, title, url, kind = 'primary') => ({id, title, url, kind});
const theoi = (id, title, file) => src(id, title, `https://www.theoi.com/Text/${file}.html`);
const edda = (id, title, file) => src(id, title, `https://en.wikisource.org/wiki/The_Poetic_Edda_(tr._Bellows)/${file}`);
const museum = (id, name) => src(id, `Rosicrucian Egyptian Museum — ${name}`, `https://egyptianmuseum.org/deities-${name.toLowerCase()}`, 'museum');
const oracc = (id, name, slug) => src(id, `ORACC — ${name}`, `https://oracc.museum.upenn.edu/amgg/listofdeities/${slug}/`, 'scholarship');
const greekPractice = src('practice', 'The Met — Greek gods and religious practices', 'https://www.metmuseum.org/essays/greek-gods-and-religious-practices', 'museum');
const snorri = src('snorri', 'Snorri Sturluson — Prose Edda, translated by R. B. Anderson', 'https://www.gutenberg.org/files/18947/18947-h/18947-h.htm');
const story = (title, text, ...sourceIds) => ({title, text, sourceIds});
const relation = (name, role) => ({name, role});
const symbol = (name, meaning) => ({name, meaning});
const greekVariants = 'Greek authors, sanctuaries and cities tell these stories differently. This dossier follows the named texts; Greek religion had no single fixed book.';
const norseVariants = 'The Eddas survive in medieval Icelandic manuscripts written by Christian-era authors. They witness Norse traditions but do not record every community’s belief.';

export const LORE_CLASSICAL = {
  athena: {
    identity: 'Athena is a Greek goddess of skilled craft, counsel and armed protection, bound above all to Athens.',
    worldview: ['Her protection joins intelligence with civic work. Weaving and warfare belong to the same goddess; she is not only a patron of peaceful study.'],
    stories: [
      story('The olive and the city',
        'Poseidon strikes salt water from the Acropolis and Athena plants an olive. On Cecrops’s witness the gods award the land to Athena, binding her patronage to the city and its soil.',
        'library'),
      story('An armed arrival',
        'Homeric Hymn 28 tells how Athena springs fully armed from the head of Zeus, and how heaven, earth and sea shake at her coming.',
        'hymns'),
    ],
    relationships: [
      relation('Zeus', 'Her father in the hymn.'),
      relation('Poseidon', 'Her rival for Attica in Apollodorus.'),
      relation('Cecrops', 'Witness to Athena’s gift at the founding of Athens.'),
    ],
    symbols: [
      symbol('Owl and olive', 'Struck on Athenian coins; signs of the city as well as of the goddess.'),
      symbol('Helmet', 'Armed guardianship, not only abstract wisdom.'),
    ],
    practice: ['Athena’s patronage belonged to particular cities; Greeks also honoured many other gods at local sanctuaries.'],
    variants: [greekVariants],
    sources: [
      theoi('library', 'Apollodorus, Library 3.14.1 — Attica', 'Apollodorus3'),
      theoi('hymns', 'Homeric Hymn 28 — Athena', 'HomericHymns3'),
      theoi('mentor', 'Homer, Odyssey 2 — Athena in the likeness of Mentor', 'HomerOdyssey2'),
      src('coin', 'University of Colorado — Athenian tetradrachm', 'https://www.colorado.edu/project/expressionsofidentity/silver-tetradrachm-athens-430-bce', 'museum'),
      greekPractice,
    ],
  },
  zeus: {
    identity: 'Zeus rules the Olympian gods in Greek poetry and is linked with the sky, thunder, kingship and the keeping of divine order.',
    worldview: ['He wins his rule through conflict and agreement among many gods. Greek divine kingship is not the same as the one God of Jewish and Christian faith.'],
    stories: [
      story('A child hidden from Cronus',
        'Rhea hides the infant Zeus in Crete and gives Cronus a stone wrapped in swaddling. Zeus later frees his siblings and overthrows the older gods.',
        'theogony'),
      story('The defeat of Typhoeus',
        'Zeus meets the monster Typhoeus with thunder and lightning and casts him into Tartarus, securing the new order after the war with the Titans.',
        'theogony'),
    ],
    relationships: [
      relation('Rhea and Cronus', 'His parents in Hesiod’s genealogy.'),
      relation('Poseidon and Hades', 'Brothers who hold the sea and the dead.'),
      relation('Themis', 'Linked with divine counsel in Homeric Hymn 23.'),
    ],
    symbols: [
      symbol('Thunderbolt', 'His weapon and the visible mark of his rule.'),
      symbol('The divine assembly', 'Rule exercised among the gods, not alone.'),
    ],
    practice: ['Sanctuaries and festivals made honouring the gods part of civic life. Myths and ritual were related but not identical.'],
    variants: [greekVariants],
    sources: [
      theoi('theogony', 'Hesiod, Theogony — Cronus, the Titans and Typhoeus', 'HesiodTheogony'),
      theoi('hymns', 'Homeric Hymn 23 — Zeus', 'HomericHymns3'),
      theoi('pausanias', 'Pausanias, Description of Greece 5.1–15 — Olympia', 'Pausanias5A'),
      greekPractice,
    ],
  },
  poseidon: {
    identity: 'Poseidon is a Greek god of the sea, earthquakes and horses, called the Earthshaker by Homer.',
    worldview: ['The sea both carries and threatens travellers. Homeric Hymn 22 asks Poseidon to help sailors while fearing his earth-shaking force.'],
    stories: [
      story('A divided cosmos',
        'In Iliad 15 Poseidon recalls the lots that gave him the sea, Hades the dead and Zeus the sky, with earth and Olympus shared. His quarrel with Zeus is about rank.',
        'iliad'),
      story('The contest for Attica',
        'Poseidon strikes the Acropolis with his trident and brings forth salt water. Athena’s olive wins the judgement, and the angry god floods the Thriasian plain.',
        'library'),
    ],
    relationships: [
      relation('Zeus and Hades', 'Brothers who shared out the world by lot.'),
      relation('Athena', 'His rival for Attica.'),
    ],
    symbols: [
      symbol('Trident', 'The instrument of the Acropolis sign in Apollodorus.'),
      symbol('Horse and ship', 'The hymn pairs the tamer of horses with the saviour of ships.'),
    ],
    practice: ['Homeric Hymn 22 is a prayer for safe voyages: divine strength could be approached in prayer as well as feared.'],
    variants: [greekVariants],
    sources: [
      theoi('iliad', 'Homer, Iliad 15 — Poseidon’s domain', 'HomerIliad15'),
      theoi('library', 'Apollodorus, Library 3.14.1 — Attica', 'Apollodorus3'),
      theoi('hymns', 'Homeric Hymn 22 — Poseidon', 'HomericHymns3'),
      src('critias', 'Plato, Critias 113c–114c — Poseidon’s island', 'https://www.gutenberg.org/ebooks/1571'),
    ],
  },
  demeter: {
    identity: 'Demeter is the Greek goddess of grain and the mother of Persephone. Her hymn ties human food to loss, search and return.',
    worldview: ['The harvest depends on a bond broken by Persephone’s abduction. When Demeter withholds the grain, hunger threatens mortals and the honours of the gods alike.'],
    stories: [
      story('The search for Persephone',
        'After Hades carries off Persephone, Demeter searches and grieves, and stops the grain from growing, until even Zeus must bargain for her daughter’s return.',
        'hymn'),
      story('Eleusis and the return',
        'Disguised as an old woman, Demeter nurses Demophon at Eleusis. When Persephone returns for part of each year, the fields grow again and Demeter teaches her rites, whose secrets the hymn keeps.',
        'hymn'),
    ],
    relationships: [
      relation('Persephone', 'The daughter whose absence and return shape the hymn.'),
      relation('Hades', 'Ruler of the dead and Persephone’s abductor.'),
      relation('Demophon', 'The child Demeter nurses at Eleusis.'),
    ],
    symbols: [
      symbol('Grain', 'Human dependence on sowing and renewed growth.'),
      symbol('Torch', 'The search for Persephone.'),
    ],
    practice: ['The hymn links Demeter with the Eleusinian Mysteries. Their secrecy means the full rites cannot be reconstructed with confidence.'],
    variants: [greekVariants],
    sources: [
      theoi('hymn', 'Homeric Hymn 2 — Demeter', 'HomericHymns1'),
      theoi('pausanias', 'Pausanias, Description of Greece 1.30–44 — Eleusis and the Rharian plain', 'Pausanias1C'),
      greekPractice,
    ],
  },
  artemis: {
    identity: 'Artemis is a Greek goddess of the hunt, wild places and the young, whom women also called on in childbirth.',
    worldview: ['Wildness and care belong together in her stories. Callimachus places mountain hunting and help for women in labour among the honours she asks of Zeus.'],
    stories: [
      story('Choosing her own honours',
        'In Callimachus’s hymn the child Artemis asks Zeus for lasting maidenhood, a bow, the mountains and companions. Zeus grants her wishes and adds cities to her care.',
        'callimachus'),
      story('The making of a huntress',
        'She goes to the Cyclopes for her bow and arrows and to Pan for her hounds. Her identity is built from particular companions, weapons and landscapes.',
        'callimachus'),
    ],
    relationships: [
      relation('Zeus', 'Her father, who grants her honours.'),
      relation('Apollo', 'Her twin brother.'),
      relation('Pan and the Cyclopes', 'Givers of her hounds and her weapons.'),
    ],
    symbols: [
      symbol('Bow and hounds', 'Her hunting attributes.'),
      symbol('Mountains', 'Her chosen ground in Callimachus.'),
    ],
    practice: ['Her hymn names cities as well as mountains; her worship was not only a matter of the wild.'],
    variants: ['Local forms of Artemis differed widely and should not be merged into a single moon goddess. This dossier follows the named texts.'],
    sources: [
      theoi('callimachus', 'Callimachus, Hymn 3 — Artemis', 'CallimachusHymns1'),
      theoi('hymns', 'Homeric Hymn 27 — Artemis of the golden arrows', 'HomericHymns3'),
      greekPractice,
    ],
  },
  hermes: {
    identity: 'Hermes is the Greek messenger god; his Homeric hymn celebrates cunning, theft, music and a bargain struck with Apollo.',
    worldview: ['The hymn does not make cleverness simply respectable. Hermes upsets an existing order and then wins a recognised place within it.'],
    stories: [
      story('The cattle and the tracks',
        'On the day of his birth Hermes steals Apollo’s cattle and confuses their trail. Challenged, he denies everything with comic boldness until Zeus sends the brothers to settle it.',
        'hermes'),
      story('A lyre settles the quarrel',
        'Hermes makes a lyre from a tortoise shell. Its music delights Apollo, and the exchange of gifts turns their quarrel into a lasting bond.',
        'hermes'),
    ],
    relationships: [
      relation('Maia and Zeus', 'His parents in the hymn.'),
      relation('Apollo', 'The brother he robs, bargains with and befriends.'),
    ],
    symbols: [
      symbol('Lyre', 'The crafted gift that ends the quarrel.'),
      symbol('Herald’s staff', 'The golden staff Apollo gives him at the hymn’s close.'),
    ],
    practice: ['Hymns could praise a god’s mischief without offering it as a model for worshippers.'],
    variants: [greekVariants],
    sources: [
      theoi('hermes', 'Homeric Hymn 4 — Hermes', 'HomericHymns2'),
      theoi('sandals', 'Homer, Odyssey 5 — the golden sandals', 'HomerOdyssey5'),
      greekPractice,
    ],
  },
  ra: {
    identity: 'Ra, also written Re, is the Egyptian sun god of creation and kingship, whose cult centre was Heliopolis.',
    worldview: ['The daily sun renews the world and keeps order against chaos. Egyptian religion joined his form with others, as Ra-Horakhty, without erasing the differences.'],
    stories: [
      story('The solar barque and Apophis',
        'A British Museum ostracon shows Ra in his barque spearing the serpent Apophis in the water: a threat to the sun’s course, and its defeat.',
        'barque'),
      story('The secret name',
        'In a healing text from Turin, Isis makes a serpent that bites Ra and will not cure him until he tells her his hidden name. The tale served as a spell against venom.',
        'name'),
    ],
    relationships: [
      relation('Isis', 'Wins Ra’s hidden name in the healing text.'),
      relation('Apophis', 'The serpent enemy of the sun’s course.'),
      relation('Horus of the horizon', 'Joined with Ra as Ra-Horakhty.'),
    ],
    symbols: [
      symbol('Sun disk and barque', 'The sun present in the sky and travelling through it.'),
      symbol('Falcon head', 'One of his forms, not the only one.'),
    ],
    practice: ['Solar religion lived in temple ritual and royal ideology as well as in stories; the Turin text shows one healing use.'],
    variants: ['Egyptian cosmologies differ by place and period. Ra, Atum, Amun-Ra and Ra-Horakhty are not interchangeable names in every source.'],
    sources: [
      museum('ra', 'Ra'),
      src('barque', 'British Museum — solar barque ostracon EA 29509', 'https://www.britishmuseum.org/collection/object/Y_EA29509', 'museum'),
      src('name', 'UCL Digital Egypt — Isis and Ra, Papyrus Turin 1993', 'https://www.ucl.ac.uk/museums-static/digitalegypt/literature/isisandra.html'),
    ],
  },
  osiris: {
    identity: 'Osiris is the Egyptian god of the dead and of renewal. Restored after his murder, he rules the dead rather than returning to earthly rule.',
    worldview: ['Life after death and new growth meet in his images. His family story of loss, restoration and succession shapes divine and royal order.'],
    stories: [
      story('The restoration of Osiris',
        'Seth kills Osiris, and Isis, helped by Nephthys, gathers and restores him. Osiris becomes ruler of the dead while his son Horus takes up the struggle for the throne.',
        'osiris'),
      story('Grain that lives again',
        'Egyptians made grain-mummies, figures of Osiris filled with earth and seed. The seed’s sprouting made his renewal visible.',
        'grain'),
    ],
    relationships: [
      relation('Isis', 'His sister and wife.'),
      relation('Horus', 'His son and heir.'),
      relation('Seth', 'His brother and murderer.'),
      relation('Nephthys', 'Helps to mourn and restore him.'),
    ],
    symbols: [
      symbol('Wrapped figure', 'His place among the preserved dead.'),
      symbol('Sprouting grain', 'Renewal seen in germinating seed.'),
    ],
    practice: ['Grain-mummies joined ritual objects with renewal; surviving examples belong to particular periods, not all of Egyptian history.'],
    variants: ['The Osiris story grew over many centuries. This short sequence follows the cited museum account, not one complete ancient text.'],
    sources: [
      museum('osiris', 'Osiris'),
      src('grain', 'The Met — mask and foot cover of a grain mummy', 'https://www.metmuseum.org/art/collection/search/545952', 'museum'),
      src('plutarch', 'Plutarch, On Isis and Osiris (Loeb translation, LacusCurtius)', 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Plutarch/Moralia/Isis_and_Osiris*/A.html'),
    ],
  },
  isis: {
    identity: 'Isis, in Egyptian Aset, is linked with protective magic, motherhood and the royal line. Her worship spread far beyond Egypt.',
    worldview: ['Her power rests on knowledge, persistence and protection, always within her divine family.'],
    stories: [
      story('Searching for Osiris',
        'Isis gathers the body of her murdered husband and helps restore him. Her grief becomes action that carries the royal line to their son Horus.',
        'isis'),
      story('Knowing Ra’s name',
        'In the Turin healing text Isis creates the danger that forces Ra to reveal his secret name, then draws out the venom: knowledge used as leverage, not simple kindness.',
        'name'),
    ],
    relationships: [
      relation('Osiris', 'Her brother and husband.'),
      relation('Horus', 'The son she protects.'),
      relation('Nephthys', 'Her sister and helper.'),
      relation('Ra', 'The god whose secret name she learns.'),
    ],
    symbols: [
      symbol('Throne sign', 'The headdress that spells her name.'),
      symbol('Protective wings', 'Shelter and restoration.'),
    ],
    practice: ['Her cult spread across the Mediterranean; later images and titles reflect that history, not one unchanging theology.'],
    variants: ['Aset and Isis are the Egyptian and Greek forms of her name. Later cow horns and sun disk do not make Isis and Hathor identical.'],
    sources: [
      museum('isis', 'Isis'),
      src('name', 'UCL Digital Egypt — Isis and Ra', 'https://www.ucl.ac.uk/museums-static/digitalegypt/literature/isisandra.html'),
      src('herodotus', 'Herodotus, Histories 2 — Chemmis and Sais', 'https://www.gutenberg.org/ebooks/2707'),
    ],
  },
  horus: {
    identity: 'Horus is the Egyptian falcon god of kingship and the sky. Every pharaoh ruled as the living Horus.',
    worldview: ['Royal legitimacy and restored wholeness drive his story. His right to rule is contested, not simply granted.'],
    stories: [
      story('The contested throne',
        'After Osiris dies, Horus challenges his uncle Seth for the kingship. The contest ties the family of the gods to the legitimacy of kings, and each telling develops it differently.',
        'horus'),
      story('An injured eye made whole',
        'The wedjat is Horus’s wounded eye restored. The Met’s account names Thoth as its healer, and the eye became a favourite protective amulet.',
        'eye'),
    ],
    relationships: [
      relation('Isis and Osiris', 'His parents in the younger Horus tradition.'),
      relation('Seth', 'His rival for the throne.'),
      relation('Thoth', 'Heals his eye in the cited account.'),
    ],
    symbols: [
      symbol('Falcon and double crown', 'Sky and kingship.'),
      symbol('Wedjat eye', 'Protection and restored wholeness.'),
    ],
    practice: ['Wedjat amulets carried the restoring power of the eye into daily and funerary life.'],
    variants: ['Horus the Elder, Horus the Child and Ra-Horakhty have related but distinct histories, and accounts differ on who healed the eye.'],
    sources: [
      museum('horus', 'Horus'),
      src('eye', 'The Met — wedjat eye amulet', 'https://www.metmuseum.org/art/collection/search/547767', 'museum'),
    ],
  },
  thoth: {
    identity: 'Thoth, in Egyptian Djehuty, is the god of writing, reckoning, the moon and sacred knowledge, shown as an ibis or a baboon.',
    worldview: ['His knowledge keeps records and sustains order. In the judgement of the dead, he answers for the accuracy of the reckoning.'],
    stories: [
      story('Recording the judgement',
        'In the Greenfield Papyrus the heart is weighed against Maat. Anubis and Thoth oversee the scales, with Thoth shown as a baboon.',
        'judgment'),
      story('The restored eye',
        'In the Met’s account of the wedjat amulet, Thoth heals the injured eye of Horus, joining his knowledge to restoration.',
        'eye'),
    ],
    relationships: [
      relation('Ra', 'The sun god whose order Thoth serves.'),
      relation('Horus', 'Receives the restored eye.'),
      relation('Maat and Anubis', 'Present at the judgement.'),
    ],
    symbols: [
      symbol('Ibis and baboon', 'His two sacred animals.'),
      symbol('Palette and moon', 'Writing and the reckoning of time.'),
    ],
    practice: ['Scribes honoured him as their patron, and he had a separate role in funerary judgement.'],
    variants: ['Accounts of his origin differ: some say he came from Ra, others that he created himself. These are alternatives, not one story.'],
    sources: [
      museum('thoth', 'Thoth'),
      src('judgment', 'British Museum — Greenfield Papyrus, the weighing of the heart', 'https://www.britishmuseum.org/collection/object/Y_EA10554-80', 'museum'),
      src('eye', 'The Met — the restored eye of Horus', 'https://www.metmuseum.org/art/collection/search/547767', 'museum'),
    ],
  },
  inanna: {
    identity: 'Inanna, Sumerian Inana and later Akkadian Ishtar, is the goddess of love, war and the planet Venus, with her great temple at Uruk.',
    worldview: ['Her stories weigh power, risk and the transfer of divine authority. The Sumerian and Akkadian traditions overlap without being the same.'],
    stories: [
      story('The seven gates',
        'Inanna leaves her temples and descends to the underworld, giving up her regalia at each gate, and dies. Ninshubur seeks help, Enki restores her, and a substitute must take her place.',
        'descent'),
      story('Bringing the powers to Uruk',
        'At a feast Enki gives Inanna the me, the divine powers of civilisation, and she carries them away to Uruk in her boat while his servants try to win them back.',
        'powers'),
    ],
    relationships: [
      relation('Ereshkigal', 'Queen of the underworld in the Descent.'),
      relation('Ninshubur', 'Her faithful minister.'),
      relation('Dumuzi', 'Her husband, given up as her substitute.'),
    ],
    symbols: [
      symbol('Eight-pointed star', 'Venus, her star on Babylonian boundary stones.'),
      symbol('Lion', 'Her martial companion in ORACC’s account.'),
    ],
    practice: ['Uruk was the great centre of her cult; local forms and periods of worship complicate any single biography.'],
    variants: ['Inanna and Ishtar are historically linked, but their descent stories differ. These episodes follow the Sumerian texts translated by ETCSL.'],
    sources: [
      oracc('identity', 'Inana/Ishtar', 'inanaitar'),
      src('descent', 'Oxford ETCSL — Inana’s descent to the nether world', 'https://etcsl.orinst.ox.ac.uk/section1/tr141.htm'),
      src('powers', 'Oxford ETCSL — Inana and Enki', 'https://etcsl.orinst.ox.ac.uk/section1/tr131.htm'),
      src('ninmesara', 'Oxford ETCSL — The exaltation of Inana (Inana B, Nin-me-šara)', 'https://etcsl.orinst.ox.ac.uk/section4/tr4072.htm'),
    ],
  },
  enki: {
    identity: 'Enki, Akkadian Ea, is the Mesopotamian god of wisdom, crafts, spells and the sweet waters of the abzu beneath the earth.',
    worldview: ['Fresh water and knowledge sustain ordered life. The abzu is the sweet-water deep of Mesopotamian cosmology, not the open sea.'],
    stories: [
      story('Ordering the world',
        'In Enki and the World Order he blesses the lands, fills the rivers and assigns each task and region to a god, tying plenty to an ordered sharing of work.',
        'order'),
      story('A warning before the flood',
        'When the gods resolve to destroy humanity, Ea warns one man to build a boat. His cunning saves life against an overwhelming divine decision.',
        'enki'),
    ],
    relationships: [
      relation('Isimud', 'His two-faced minister.'),
      relation('Enlil', 'The god whose decision Ea undoes in the flood story.'),
      relation('Atrahasis', 'The man Ea warns.'),
    ],
    symbols: [
      symbol('Flowing streams with fish', 'His sign on cylinder seals.'),
      symbol('The abzu', 'His dwelling in the sweet-water deep.'),
    ],
    practice: ['Diviners and exorcists called on Ea as the source of their ritual knowledge.'],
    variants: ['Sumerian Enki texts and Akkadian Ea stories have their own wording; Atrahasis and the Gilgamesh flood are not one text.'],
    sources: [
      oracc('enki', 'Enki/Ea', 'enki'),
      src('order', 'Oxford ETCSL — Enki and the World Order', 'https://etcsl.orinst.ox.ac.uk/section1/tr113.htm'),
      src('hymns', 'Oxford ETCSL — The Temple Hymns (Eridu and Kuara)', 'https://etcsl.orinst.ox.ac.uk/section4/tr4801.htm'),
    ],
  },
  marduk: {
    identity: 'Marduk is the patron god of Babylon. His rise to the head of the pantheon followed the city’s rise to power.',
    worldview: ['Babylonian creation poetry sets Babylon and its god at the centre of the world. That claim belongs to particular texts and a particular history.'],
    stories: [
      story('The battle with Tiamat',
        'In the Enuma Elish the gods make Marduk their champion. He catches Tiamat in his net, splits her body to form heaven and earth, and is given kingship among the gods.',
        'tiamat'),
      story('Babylon’s patron',
        'Marduk’s temple Esagila stood in Babylon, and his standing grew with the city. ORACC traces that growth and the uncertainty about his earliest written mentions.',
        'marduk'),
    ],
    relationships: [
      relation('Ea', 'His father in the Babylonian genealogy.'),
      relation('Tiamat', 'His opponent in the Enuma Elish.'),
      relation('Nabu', 'His son, patron of scribes.'),
    ],
    symbols: [
      symbol('Mushhushshu dragon', 'The serpent-dragon that is Marduk’s own emblem.'),
      symbol('Spade', 'His sign on boundary stones.'),
    ],
    practice: ['The Enuma Elish was linked with Babylon’s New Year festival; that setting was not shared by every Mesopotamian city.'],
    variants: ['Calling Marduk a storm god captures only part of his history; scholars disagree about his earliest roles.'],
    sources: [
      oracc('marduk', 'Marduk', 'marduk'),
      src('tiamat', 'ORACC — Tiamat and the Babylonian creation epic', 'https://oracc2.museum.upenn.edu/amgg/Listofdeities/Tiamat/index.html', 'scholarship'),
      src('hammurabi', 'Yale Avalon Project — the Code of Hammurabi, translated by L. W. King', 'https://avalon.law.yale.edu/ancient/hamframe.asp'),
    ],
  },
  thor: {
    identity: 'Thor, Old Norse Þórr, is the strongest of the Norse gods, the thunderer who defends gods and people with the hammer Mjölnir.',
    worldview: ['His stories mix danger with comedy and plain force. Thor guards the world of gods and humans against the giants.'],
    stories: [
      story('Recovering the hammer',
        'The giant Thrym steals Mjölnir and demands Freyja as his bride. Thor goes to the wedding disguised as Freyja, with Loki as his maid, and when the hammer is brought out he takes it back.',
        'thrym'),
      story('Fishing for the serpent',
        'Thor rows out with the giant Hymir, baits his hook with an ox head and hauls up the world serpent, strength against a creature that encircles the world.',
        'hymir'),
    ],
    relationships: [
      relation('Loki', 'His companion in the hammer poem.'),
      relation('Freyja', 'Refuses to marry Thrym.'),
      relation('Jörmungandr', 'The world serpent he fishes for.'),
    ],
    symbols: [
      symbol('Mjölnir', 'The hammer at the heart of the poem.'),
      symbol('Hammer pendant', 'Worn for protection in the Viking Age.'),
    ],
    practice: ['Hammer-shaped pendants show that Thor’s protection was carried on the body. Poems and amulets are different kinds of evidence.'],
    variants: ['The Eddas survive in Christian-era Icelandic manuscripts, and the fishing story ends differently in different tellings.'],
    sources: [
      edda('thrym', 'Poetic Edda — Thrymskvitha', 'Thrymskvitha'),
      edda('hymir', 'Poetic Edda — Hymiskvitha', 'Hymiskvitha'),
      src('pendants', 'British Museum — Room 41 guide, Thor’s hammer pendant', 'https://www.britishmuseum.org/sites/default/files/2021-05/large_print_guide_room_41.pdf', 'museum'),
      snorri,
    ],
  },
  odin: {
    identity: 'Odin, Old Norse Óðinn, is the Norse god of knowledge, poetry, death and kingship, who pays dearly for what he learns.',
    worldview: ['Knowledge is won through risk and sacrifice. The poems do not make him a gentle scholar or a simple war god.'],
    stories: [
      story('The ordeal for the runes',
        'In Hávamál the speaker hangs for nine nights on a windswept tree, wounded and given to Odin, himself to himself, before he takes up the runes.',
        'havamal'),
      story('The ravens’ return',
        'Grímnismál names Huginn and Muninn, who fly over the world each day. Odin fears they may not come back: wide knowledge brings vulnerability.',
        'grimnir'),
    ],
    relationships: [
      relation('Huginn and Muninn', 'His ravens, Thought and Memory.'),
      relation('Mímir', 'Keeper of the well where Odin pledged an eye.'),
    ],
    symbols: [
      symbol('Two ravens', 'Carriers of news in Grímnismál.'),
      symbol('One eye', 'Pledged at Mímir’s well (Völuspá 28); the sources give him no eyepatch.'),
    ],
    practice: ['Hávamál gathers poetic counsel and sacred lore; it does not describe a single fixed initiation rite.'],
    variants: [norseVariants],
    sources: [
      edda('havamal', 'Poetic Edda — Hovamol, the rune ordeal', 'Hovamol'),
      edda('grimnir', 'Poetic Edda — Grimnismol, the ravens', 'Grimnismol'),
      edda('voluspa', 'Poetic Edda — Voluspo, Odin’s eye', 'Voluspo'),
    ],
  },
  freyja: {
    identity: 'Freyja is a Norse goddess of desire, precious things and the battle-dead, one of the Vanir, and not another name for Frigg.',
    worldview: ['Her traditions join beauty, independence and death. Seeing her only as a romantic figure loses much of the evidence.'],
    stories: [
      story('A share of the fallen',
        'Grímnismál says Freyja chooses half of the slain each day for her field Fólkvangr, while Odin takes the other half.',
        'grimnir'),
      story('Refusing Thrym',
        'When the giant Thrym demands her as his bride, Freyja refuses in fury, and the gods must send Thor in disguise instead.',
        'thrym'),
    ],
    relationships: [
      relation('Freyr', 'Her brother.'),
      relation('Odin', 'Takes the other half of the slain.'),
      relation('Thor and Loki', 'Carry out the plan after her refusal.'),
    ],
    symbols: [
      symbol('Brísingamen', 'The necklace named in the hammer poem.'),
      symbol('Fólkvangr', 'Her field for the slain, not another name for Valhalla.'),
    ],
    practice: ['These poems are stories, not full accounts of worship, and do not show one ritual for all Norse communities.'],
    variants: [norseVariants],
    sources: [
      edda('grimnir', 'Poetic Edda — Grimnismol, Folkvang', 'Grimnismol'),
      edda('thrym', 'Poetic Edda — Thrymskvitha, Freyja’s refusal', 'Thrymskvitha'),
      snorri,
    ],
  },
  freyr: {
    identity: 'Freyr is a Norse god of prosperity, peace and good seasons, worshipped at Uppsala. His courtship poem contains coercion, not simple romance.',
    worldview: ['Plenty and vulnerability go together. Freyr gives away his sword for love, and the loss matters at the end of the world.'],
    stories: [
      story('The sword sent away',
        'In Skírnismál Freyr sends his servant Skírnir to woo Gerðr, giving him his horse and his sword, which fights by itself.',
        'skirnir'),
      story('Gerðr’s answer',
        'Skírnir offers gifts, then threats and a curse, before Gerðr agrees to meet Freyr at Barri. An honest summary must name that pressure.',
        'skirnir'),
    ],
    relationships: [
      relation('Gerðr', 'The giantess Freyr desires.'),
      relation('Skírnir', 'The servant who carries his suit, and his threats.'),
      relation('Freyja', 'His sister.'),
    ],
    symbols: [
      symbol('The lost sword', 'Power given away for another goal.'),
      symbol('Gullinbursti', 'His golden-bristled boar.'),
    ],
    practice: ['Snorri links Freyr with rain, sunshine and peace, and Adam of Bremen describes his image at Uppsala.'],
    variants: [norseVariants],
    sources: [
      edda('skirnir', 'Poetic Edda — Skirnismol', 'Skirnismol'),
      snorri,
    ],
  },
  skadi: {
    identity: 'Skadi, Old Norse Skaði, is a mountain huntress of giant descent who marries into the gods. Jötunn does not always mean monster.',
    worldview: ['Her story begins with a demand for justice. Negotiation, a mistaken choice and love of her home land matter as much as force.'],
    stories: [
      story('Compensation for Þjazi',
        'Skadi arrives armed to avenge her father Þjazi. The gods offer a settlement: she may choose a husband by his feet alone. Hoping for Baldr, she chooses Njörðr.',
        'snorri'),
      story('Two homes that do not agree',
        'Skadi and Njörðr cannot share a home: the wolves of the mountains trouble him, and the gulls of the shore trouble her. She returns to Þrymheimr.',
        'snorri'),
    ],
    relationships: [
      relation('Þjazi', 'Her father, whom she comes to avenge.'),
      relation('Njörðr', 'The husband she chooses.'),
      relation('Loki', 'Makes her laugh as part of the settlement.'),
    ],
    symbols: [
      symbol('Skis and bow', 'Mountain travel and hunting in Snorri.'),
      symbol('Þrymheimr', 'Her father’s mountain home.'),
    ],
    practice: ['This dossier follows the written stories; it does not invent a winter ritual from her modern popularity.'],
    variants: ['The Eddas survive in Christian-era manuscripts. “Goddess of winter” is a modern shorthand; the sources speak of mountains, hunting and family justice.'],
    sources: [
      snorri,
      edda('grimnir', 'Poetic Edda — Grimnismol, Thrymheim', 'Grimnismol'),
    ],
  },
};
