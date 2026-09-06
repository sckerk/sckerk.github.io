// JSON-LD, one blob per route key, emitted by the layout into <head>.
//
// Two types only, and that is a deliberate ceiling:
//
//   WebSite on "/"   - names the site and its canonical origin.
//   Person on "/bio/" - the artist. Every field below is copied out of
//                       src/bio.njk or src/contact.njk verbatim.
//
// There is NO VisualArtwork markup and none should ever be added. It is only
// worth emitting with `artform`, `artMedium`, `artworkSurface` or
// `dateCreated`, and no per-work metadata exists anywhere in this repo - the
// 33 works have alt text and nothing else. Inventing a medium or a year to
// satisfy a schema would be publishing a false factual claim about someone's
// art, which is worse than having no structured data at all.
//
// Likewise, nothing here is inferred. `alumniOf` lists the four institutions in
// the Education block of src/bio.njk and no others; the two exhibiting
// institutions named in the description are both in the Exhibitions block.

const site = require("./site.json");
const routes = require("./routes.js");

const PERSON_URL = `${site.origin}${routes.byKey.bio.path}`;

// Both name orders are real and both are in use: exhibitions bill the artist as
// "Kerk Siew Chu" and the site header has always read "Siew Chu Kerk". Search
// copy standardises on the exhibition order (see src/_data/routes.js), so the
// other order and the Chinese name are carried here, which is what keeps a
// search for any of the three resolving to this person.
const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Kerk Siew Chu",
    alternateName: ["Siew Chu Kerk", "郭秀洙"],
    jobTitle: "Artist",
    nationality: { "@type": "Country", name: "Malaysia" },
    birthPlace: { "@type": "Place", name: "Batu Pahat, Malaysia" },
    homeLocation: { "@type": "Place", name: "New York, New York" },
    url: PERSON_URL,
    mainEntityOfPage: PERSON_URL,
    image: `${site.origin}${site.ogImage.path}`,
    description: routes.byKey.bio.description,
    alumniOf: [
        { "@type": "CollegeOrUniversity", name: "New York University" },
        { "@type": "CollegeOrUniversity", name: "City of London Polytechnic" },
        { "@type": "CollegeOrUniversity", name: "Byam Shaw School of Art" },
        { "@type": "CollegeOrUniversity", name: "National Taiwan Normal University" },
    ],
    sameAs: ["https://www.facebook.com/kerksiewchu/"],
};

const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.title,
    alternateName: "Siew Chu Kerk",
    url: `${site.origin}/`,
    description: routes.byKey.home.description,
    inLanguage: "en",
    author: { "@type": "Person", name: "Kerk Siew Chu", url: PERSON_URL },
};

// Serialised here rather than in the template. Nunjucks' `dump` filter is a
// bare JSON.stringify, and its output goes inside a <script> element where a
// literal "</script>" in any string would close the block early and drop the
// rest of the JSON into the document as text. None of the copy above contains
// one today, but escaping "<" at the single point of serialisation means no
// future edit to a description can turn into an injection.
function serialise(data) {
    return JSON.stringify(data, null, 4).replace(/</g, "\\u003C");
}

module.exports = {
    home: serialise(website),
    bio: serialise(person),
};
