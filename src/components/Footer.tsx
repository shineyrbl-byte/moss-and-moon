"use client";
import Link from "next/link";
import { hoursLabel, whatsappUrl } from "@/lib/cafe";
import InstallButton from "./InstallButton";
import HiddenMoon from "./HiddenMoon";
import { useStore } from "./Store";

export default function Footer() {
  const { t } = useStore();
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <p className="logo">Moss <span>&</span> Moon</p>
          <p className="muted small" style={{ maxWidth: "22rem", marginTop: "0.6rem" }}>
            A slow-coffee corner with pink lattes, warm bakes and a sunny window seat. Made with oat milk & love.
          </p>
        </div>
        <div className="footer-explore">
          <h2>{t("footer.explore")}</h2>
          <ul>
            <li><Link href="/#menu">{t("nav.menu")}</Link></li>
            <li><Link href="/#events">{t("nav.events")}</Link></li>
            <li><Link href="/#reviews">{t("footer.reviews")}</Link></li>
            <li><Link href="/loyalty">{t("nav.stamps")}</Link></li>
            <li><Link href="/gift-cards">{t("nav.gift")}</Link></li>
            <li><Link href="/gift-a-drink">{t("footer.giftDrink")}</Link></li>
            <li><Link href="/noticeboard">{t("footer.noticeboard")}</Link></li>
            <li><Link href="/journal">{t("footer.journal")}</Link></li>
            <li><Link href="/recipes">{t("footer.recipes")}</Link></li>
            <li><Link href="/diary">{t("footer.diary")}</Link></li>
            <li><Link href="/brew">{t("footer.brew")}</Link></li>
            <li><Link href="/origins">{t("footer.origins")}</Link></li>
            <li><Link href="/passport">{t("footer.passport")}</Link></li>
            <li><Link href="/lab">{t("footer.lab")}</Link></li>
            <li><Link href="/shelf">{t("footer.shelf")}</Link></li>
            <li><Link href="/team">{t("footer.team")}</Link></li>
            <li><Link href="/postcard">{t("footer.postcard")}</Link></li>
            <li><Link href="/advent">{t("footer.advent")}</Link></li>
            <li><Link href="/bingo">{t("footer.bingo")}</Link></li>
            <li><Link href="/focus">{t("footer.focus")}</Link></li>
            <li><Link href="/songs">{t("footer.songs")}</Link></li>
            <li><Link href="/pups">{t("footer.pups")}</Link></li>
            <li><Link href="/trivia">{t("footer.trivia")}</Link></li>
            <li><Link href="/plants">{t("footer.plants")}</Link></li>
            <li><Link href="/colouring">{t("footer.colouring")}</Link></li>
            <li><Link href="/pay-it-forward">{t("footer.forward")}</Link></li>
            <li><Link href="/year">{t("footer.year")}</Link></li>
            <li><Link href="/word">{t("footer.word")}</Link></li>
            <li><Link href="/fortune">{t("footer.fortune")}</Link></li>
            <li><Link href="/letters">{t("footer.letters")}</Link></li>
            <li><Link href="/bring-it-back">{t("footer.comeback")}</Link></li>
            <li><Link href="/nearby">{t("footer.nearby")}</Link></li>
            <li><Link href="/secret">{t("footer.secret")}</Link></li>
            <li><Link href="/doodles">{t("footer.doodles")}</Link></li>
            <li><Link href="/book-club">{t("footer.bookClub")}</Link></li>
            <li><Link href="/konkani">{t("footer.konkani")}</Link></li>
            <li><Link href="/memory">{t("footer.memory")}</Link></li>
            <li><Link href="/wish-tree">{t("footer.wishTree")}</Link></li>
            <li><Link href="/sunset">{t("footer.sunset")}</Link></li>
            <li><Link href="/cups-saved">{t("footer.cups")}</Link></li>
            <li><Link href="/moon">{t("footer.moon")}</Link></li>
            <li><Link href="/blind-date">{t("footer.blindDate")}</Link></li>
            <li><Link href="/poll">{t("footer.poll")}</Link></li>
            <li><Link href="/stories">{t("footer.stories")}</Link></li>
            <li><Link href="/connections">{t("footer.connections")}</Link></li>
            <li><Link href="/slide">{t("footer.slide")}</Link></li>
            <li><Link href="/scoreboard">{t("footer.scoreboard")}</Link></li>
            <li><Link href="/fruit-calendar">{t("footer.fruit")}</Link></li>
            <li><Link href="/kind-notes">{t("footer.kindNotes")}</Link></li>
            <li><Link href="/lost-found">{t("footer.lostFound")}</Link></li>
            <li><Link href="/menu-explorer">{t("footer.explorer")}</Link></li>
            <li><Link href="/latte-art">{t("footer.latteArt")}</Link></li>
            <li><Link href="/word-search">{t("footer.wordSearch")}</Link></li>
            <li><Link href="/sudoku">{t("footer.sudoku")}</Link></li>
            <li><Link href="/i-spy">{t("footer.ispy")}</Link></li>
            <li><Link href="/recipe-swap">{t("footer.recipeSwap")}</Link></li>
            <li><Link href="/connect-four">{t("footer.connect4")}</Link></li>
            <li><Link href="/story-chain">{t("footer.storyChain")}</Link></li>
            <li><Link href="/guess-the-dish">{t("footer.guessDish")}</Link></li>
            <li><Link href="/artist-wall">{t("footer.artWall")}</Link></li>
            <li><Link href="/visiting-from">{t("footer.visitingFrom")}</Link></li>
            <li><Link href="/games">{t("footer.games")}</Link></li>
            <li><Link href="/shout-outs">{t("footer.shoutouts")}</Link></li>
            <li><Link href="/adopt">{t("footer.adopt")}</Link></li>
            <li><Link href="/ask">{t("footer.ask")}</Link></li>
            <li><Link href="/crossword">{t("footer.crossword")}</Link></li>
            <li><Link href="/pixel-picture">{t("footer.pixel")}</Link></li>
            <li><Link href="/crack-the-order">{t("footer.crack")}</Link></li>
            <li><Link href="/bean-sweeper">{t("footer.sweeper")}</Link></li>
            <li><Link href="/brew-merge">{t("footer.merge")}</Link></li>
            <li><Link href="/higher-or-lower">{t("footer.higherLower")}</Link></li>
            <li><Link href="/quiz">{t("footer.quiz")}</Link></li>
            <li><Link href="/photo-booth">{t("footer.photoBooth")}</Link></li>
            <li><Link href="/split-bill">{t("footer.split")}</Link></li>
            <li><Link href="/word-ladder">{t("footer.ladder")}</Link></li>
            <li><Link href="/jigsaw">{t("footer.jigsaw")}</Link></li>
            <li><Link href="/bean-snake">{t("footer.snake")}</Link></li>
            <li><Link href="/bean-hive">{t("footer.hive")}</Link></li>
            <li><Link href="/pour-paths">{t("footer.paths")}</Link></li>
            <li><Link href="/tea-tiles">{t("footer.tiles")}</Link></li>
            <li><Link href="/spot-the-difference">{t("footer.spot")}</Link></li>
            <li><Link href="/call-the-order">{t("footer.typing")}</Link></li>
            <li><Link href="/cafe-patience">{t("footer.patience")}</Link></li>
            <li><Link href="/cryptogram">{t("footer.cipher")}</Link></li>
            <li><Link href="/cake-stacker">{t("footer.stacker")}</Link></li>
            <li><Link href="/reversi">{t("footer.reversi")}</Link></li>
            <li><Link href="/flood">{t("footer.flood")}</Link></li>
            <li><Link href="/lamp-switch">{t("footer.lamps")}</Link></li>
            <li><Link href="/sink-the-saucers">{t("footer.saucers")}</Link></li>
            <li><Link href="/bean-jumble">{t("footer.jumble")}</Link></li>
            <li><Link href="/bean-counting">{t("footer.mancala")}</Link></li>
            <li><Link href="/draughts">{t("footer.draughts")}</Link></li>
            <li><Link href="/milk-and-coffee">{t("footer.milk")}</Link></li>
            <li><Link href="/string-lights">{t("footer.lights")}</Link></li>
            <li><Link href="/sugar-cubes">{t("footer.dots")}</Link></li>
            <li><Link href="/cafe-dice">{t("footer.dice")}</Link></li>
            <li><Link href="/tray-pusher">{t("footer.tray")}</Link></li>
            <li><Link href="/delivery-jam">{t("footer.jam")}</Link></li>
            <li><Link href="/table-for-one">{t("footer.table")}</Link></li>
            <li><Link href="/parasols">{t("footer.parasols")}</Link></li>
            <li><Link href="/tip-jar">{t("footer.tipjar")}</Link></li>
            <li><Link href="/five-in-a-row">{t("footer.gomoku")}</Link></li>
            <li><Link href="/baristas-echo">{t("footer.echo")}</Link></li>
            <li><Link href="/bean-breaker">{t("footer.breaker")}</Link></li>
            <li><Link href="/cake-towers">{t("footer.towers")}</Link></li>
            <li><Link href="/spare-cups">{t("footer.spareCups")}</Link></li>
            <li><Link href="/cafe-corners">{t("footer.corners")}</Link></li>
            <li><Link href="/pastry-drop">{t("footer.pastry")}</Link></li>
            <li><Link href="/saucer-mill">{t("footer.mill")}</Link></li>
            <li><Link href="/puzzle-archive">{t("footer.archive")}</Link></li>
            <li><Link href="/my-stats">{t("footer.myStats")}</Link></li>
            <li><Link href="/bean-sums">{t("footer.sums")}</Link></li>
            <li><Link href="/cafe-freecell">{t("footer.freecell")}</Link></li>
            <li><Link href="/delivery-dash">{t("footer.dash")}</Link></li>
            <li><Link href="/cafe-hearts">{t("footer.hearts")}</Link></li>
            <li><Link href="/cafe-chess">{t("footer.chess")}</Link></li>
            <li><Link href="/terrace-backgammon">{t("footer.backgammon")}</Link></li>
            <li><Link href="/bean-boggle">{t("footer.boggle")}</Link></li>
            <li><Link href="/bill-total">{t("footer.bill")}</Link></li>
            <li><Link href="/trophies">{t("footer.trophies")}</Link></li>
            <li><Link href="/play">{t("footer.play")}</Link></li>
            <li><Link href="/catering">{t("footer.catering")}</Link></li>
            <li><Link href="/cakes">{t("footer.cakes")}</Link></li>
            {whatsappUrl() && <li><a href={whatsappUrl()!} target="_blank" rel="noopener noreferrer">{t("footer.whatsapp")}</a></li>}
            <li><Link href="/whats-new">✨ {t("footer.new")}</Link></li>
            <li><Link href="/privacy">{t("footer.privacy")}</Link> · <Link href="/terms">{t("footer.terms")}</Link></li>
            <li><Link href="/orders">{t("footer.orders")}</Link></li>
          </ul>
        </div>
        <div>
          <h2>{t("footer.hours")}</h2>
          <ul>
            {hoursLabel().map((h) => (
              <li key={h.days}>{h.days} · {h.time}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>{t("footer.hi")}</h2>
          <ul>
            <li>14 Willow Lane</li>
            <li>hello@mossandmoon.cafe</li>
            <li><Link href="/admin">{t("footer.staff")}</Link></li>
          </ul>
          <div style={{ marginTop: "1rem" }}><InstallButton className="btn btn-pink btn-sm" /></div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Moss & Moon</span>
        <span>{t("footer.photos")} <HiddenMoon id="m-footer-7k" /></span>
      </div>
    </footer>
  );
}
