// Short, source-linked summaries of scriptural accounts. faction-lore.js adds the realm notes.
const scripture = (id, title, passage) => ({
  id,
  title,
  url: `https://www.biblegateway.com/passage/?search=${encodeURIComponent(passage)}&version=KJV`,
  kind: 'primary',
});
const story = (title, text, ...sourceIds) => ({title, text, sourceIds});
const relation = (name, role) => ({name, role});
const symbol = (name, meaning) => ({name, meaning});

export const LORE_BIBLICAL = {
  michael: {
    identity: 'God is the patron of this realm and Michael its champion. In Christian faith, angels, apostles and Jesus are not a set of rival gods.',
    worldview: ['Christian faith centres on Jesus Christ, his death and resurrection. Trinitarian Christianity confesses Father, Son and Holy Spirit as one God, not three allied deities.'],
    stories: [
      story('The risen Jesus — Luke 24',
        'Women find the tomb empty. On the road to Emmaus two disciples know Jesus when he breaks bread. He then appears to his followers, shows his wounds and sends them out as witnesses.',
        'luke24'),
      story('Michael and the dragon — Revelation 12',
        'In an apocalyptic vision Michael and his angels fight the dragon, named as the devil and Satan, and cast it out of heaven. Michael serves within God’s order; he is not a creator or a ruler in his own right.',
        'rev12'),
      story('A shared life — Acts 2',
        'After Pentecost the believers keep to the apostles’ teaching, fellowship, prayer and the breaking of bread, and share their goods according to need.',
        'acts2'),
    ],
    relationships: [
      relation('Jesus Christ', 'Central to Christian faith; not an angel or a war leader.'),
      relation('Peter and the apostles', 'Human witnesses and teachers in the New Testament.'),
      relation('Michael', 'Leader of the angels in Revelation 12; an archangel in Jude 1:9.'),
      relation('Seraphim', 'The six-winged beings of Isaiah 6 who attend God’s throne.'),
    ],
    symbols: [
      symbol('Bread and the empty tomb', 'Recognition, fellowship and resurrection in Luke 24.'),
      symbol('Six wings and a burning coal', 'The seraphim and the cleansing of Isaiah’s lips; not a picture of every angel.'),
    ],
    practice: ['Acts 2 joins worship with practical care. Churches differ in liturgy, sacraments and the use of icons.'],
    variants: ['Revelation is visionary writing, and Christian traditions read its imagery and timeline differently. Genesis 6:1–4 on the Nephilim also has several readings.'],
    sources: [
      scripture('luke24', 'Luke 24 — resurrection and Emmaus', 'Luke 24'),
      scripture('rev12', 'Revelation 12 — Michael and the dragon', 'Revelation 12'),
      scripture('acts2', 'Acts 2 — Pentecost and community', 'Acts 2'),
      scripture('isa6', 'Isaiah 6 — the seraphim', 'Isaiah 6'),
      scripture('gen6', 'Genesis 6:1–4 — the Nephilim', 'Genesis 6:1-4'),
      scripture('rev1', 'Revelation 1:11 — the seven churches', 'Revelation 1:11'),
      {id: 'trinity', title: 'Church of England — the Nicene Creed', url: 'https://www.churchofengland.org/faith-life/what-we-believe/nicene-creed', kind: 'tradition'},
    ],
  },
  gabriel: {
    identity: 'Gabriel is a heavenly messenger in Daniel and Luke. This dossier follows Luke as Christians read it and notes Gabriel’s earlier place in Jewish scripture.',
    worldview: ['The messenger’s authority comes from God. Gabriel explains visions and announces births; he is not their source, and not a god of messages. Daniel sets his visions among a people under empire.'],
    stories: [
      story('Understanding a vision — Daniel 8',
        'Gabriel is told to help Daniel understand a vision. The ram and the goat are read as kingdoms, and Daniel is left exhausted by what he has seen.',
        'dan8'),
      story('Two announcements — Luke 1',
        'Gabriel announces the birth of John to Zechariah, then tells Mary she will bear Jesus. When Mary asks how, he speaks of the Holy Spirit and the power of God. Gabriel brings the message; the child is God’s gift.',
        'luke1'),
    ],
    relationships: [
      relation('Daniel', 'Receives visions that Gabriel interprets.'),
      relation('Zechariah and Elizabeth', 'Parents of John the Baptist in Luke.'),
      relation('Mary', 'Receives the announcement of the birth of Jesus.'),
    ],
    symbols: [
      symbol('Lily', 'Later Annunciation art gives Gabriel a lily. Luke 1 names no attribute, and no Bible text gives him a trumpet.'),
    ],
    practice: ['Christians keep the feast of the Annunciation on 25 March. Wings and a lily come from later painting, not from Luke.'],
    variants: ['Gabriel also belongs to Jewish and Islamic tradition. Luke calls him an angel; the title archangel comes from later Christian use.'],
    sources: [
      scripture('dan8', 'Daniel 8:15–27 — Gabriel interprets', 'Daniel 8:15-27'),
      scripture('luke1', 'Luke 1 — Zechariah and Mary', 'Luke 1'),
      scripture('galilee', 'Luke 1:26 — a city of Galilee named Nazareth', 'Luke 1:26'),
    ],
  },
  moses: {
    identity: 'Moses is a human prophet and leader in the Torah, central to Jewish tradition and read in the Christian Old Testament. He is not a god.',
    worldview: ['Exodus presents freedom from slavery as God’s act. Moses is called despite his reluctance, and the covenant joins worship with duties toward one’s neighbour.'],
    stories: [
      story('The burning bush — Exodus 3',
        'Moses sees a bush that burns without burning up. God calls him to face Pharaoh and lead Israel out of Egypt. Moses doubts himself and asks God’s name.',
        'ex3'),
      story('The sea crossing — Exodus 14',
        'With Egypt’s army behind them, the Israelites cross through divided waters. The text credits God with the rescue while Moses stretches out his hand.',
        'ex14'),
      story('The commandments — Exodus 20',
        'The commandments join the worship of one God with duties about parents, life, marriage, property, truthful witness and desire.',
        'ex20'),
    ],
    relationships: [
      relation('Aaron', 'Moses’s brother and partner in the Exodus.'),
      relation('Miriam', 'Prophet who leads the song after the crossing in Exodus 15.'),
      relation('Joshua', 'Commissioned as Moses’s successor in Deuteronomy 31.'),
    ],
    symbols: [
      symbol('Bush, staff and tablets', 'Images of the calling, the journey and the covenant, not magic equipment.'),
    ],
    practice: ['Jewish families remember the Exodus at Passover. Christians read Exodus through their own liturgy and theology.'],
    variants: ['Jewish and Christian readings share the text but differ in interpretation. The “Red Sea” of English Bibles translates the Hebrew yam suph, whose location is debated.'],
    sources: [
      scripture('ex3', 'Exodus 3 — the calling', 'Exodus 3'),
      scripture('ex14', 'Exodus 14 — the crossing', 'Exodus 14'),
      scripture('ex20', 'Exodus 20 — the commandments', 'Exodus 20'),
      scripture('ex15', 'Exodus 15 — Miriam’s song', 'Exodus 15'),
      scripture('dt31', 'Deuteronomy 31 — Joshua commissioned', 'Deuteronomy 31'),
      scripture('ex12', 'Exodus 12 — Passover', 'Exodus 12'),
      scripture('ex24', 'Exodus 24:4 — twelve pillars for the twelve tribes', 'Exodus 24:4'),
    ],
  },
  esther: {
    identity: 'Esther, also called Hadassah, is the Jewish queen at the centre of the Book of Esther, set at the Persian court in Shushan.',
    worldview: ['A threatened Jewish community lives under a foreign empire, and Esther must act without equal power. The Hebrew book does not explicitly name God; the Greek additions add prayers.'],
    stories: [
      story('The decision to approach — Esther 4',
        'Mordecai asks Esther to plead against the decree. Entering the king’s presence unbidden can mean death, so she asks her people to fast with her and resolves to go: “if I perish, I perish.”',
        'est4'),
      story('Deliverance and remembrance — Esther 9',
        'The community survives a violent conflict. Purim is established with feasting, gifts to one another and gifts to the poor; the account also keeps the memory of mourning and bloodshed.',
        'est9'),
    ],
    relationships: [
      relation('Mordecai', 'Esther’s guardian and an advocate for their people.'),
      relation('Ahasuerus', 'The king in the Hebrew book.'),
      relation('Haman', 'The court official whose decree threatens the Jews.'),
    ],
    symbols: [
      symbol('Myrtle and the golden sceptre', 'Hadassah means myrtle (Esther 2:7); the king’s sceptre spares her at the threshold (Esther 5:2).'),
    ],
    practice: ['Purim keeps the story alive through reading the scroll of Esther, celebration, gifts and care for the poor, as Esther 9 directs.'],
    variants: ['Jewish Bibles keep the Hebrew book. Catholic and Orthodox Bibles include the Greek additions; Protestant Bibles usually omit or separate them.'],
    sources: [
      scripture('est4', 'Esther 4 — risk and fasting', 'Esther 4'),
      scripture('est9', 'Esther 9 — Purim', 'Esther 9'),
      scripture('est2', 'Esther 2 — Hadassah and Mordecai', 'Esther 2'),
      scripture('est5', 'Esther 5:2 — the golden sceptre', 'Esther 5:2'),
      {id: 'estintro', title: 'USCCB — introduction to Esther and the Greek additions', url: 'https://bible.usccb.org/bible/esther/0', kind: 'tradition'},
    ],
  },
};
