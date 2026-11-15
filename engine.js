"use strict";

/*
 * SIGIL — duello originale a tre rovine.
 * Non è affiliato a nessun altro gioco.
 *
 * Sei ore. Il lume è il numero dell'ora. Tre rovine, quattro posti
 * per lato. Tieni una rovina se hai più potenza. Vinci la notte se tieni
 * più rovine dell'Ombra. Le giocate dell'ora si scoprono insieme,
 * chi è avanti scopre per primo. Rilancio raddoppia il pegno, una volta
 * per lato. Ritirarsi consegna il pegno.
 *
 * Nel codice: turn = ora, energy = lume, location = rovina, stake = pegno.
 */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.Lume = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var HAND_MAX = 7;
  var LANE_MAX = 4;

  /*
   * Le cinque casate. Ogni carta appartiene a una casata: colore, sigillo,
   * e un modo di vincere. L'Ombra gioca le stesse carte del Custode.
   */
  var HOUSES = [
    { id: "guardia", name: "Guardia", motto: "Chi tiene la porta.", text: "Cavalieri e scudi. Potenza piena e alleati che si reggono a vicenda." },
    { id: "selva", name: "Selva", motto: "Chi non ha padrone.", text: "Bestie. Forti da sole, feroci quando la rovina è affollata." },
    { id: "congrega", name: "Congrega", motto: "Chi lega con il sale.", text: "Streghe. Aure per i tuoi, maledizioni per gli altri." },
    { id: "tesoro", name: "Tesoro", motto: "Chi conta le ore.", text: "Reliquie. Lume in più, carte in più, potere che arriva tardi." },
    { id: "fondo", name: "Fondo", motto: "Chi è già caduto.", text: "I morti. Rubano, spostano, tornano quando stai perdendo." }
  ];

  var CARDS = [
    // GUARDIA — chi tiene la porta
    { id: "corriere", house: "guardia", name: "Scudiero", cost: 1, power: 2, kind: "none", text: "", lore: "Corre ancora quando i cavalieri sono già caduti." },
    { id: "briciola", house: "guardia", name: "Paggetto", cost: 1, power: 1, kind: "reveal", text: "La tua carta più debole qui: +2.", lore: "Alza lo stendardo di chi non può più tenerlo.", ability: { op: "buff", target: "ally-weak", amount: 2 } },
    { id: "vigile", house: "guardia", name: "Guardia", cost: 2, power: 3, kind: "none", text: "", lore: "Ha visto l'alba sei volte. Questa potrebbe essere l'ultima." },
    { id: "suonatore", house: "guardia", name: "Tamburino", cost: 2, power: 1, kind: "ongoing", text: "+1 per ogni altra tua carta qui.", lore: "Il tamburo è fatto con una scaglia. Batte anche quando lui tace.", ability: { op: "self", cond: "per-ally", amount: 1 } },
    { id: "barista", house: "guardia", name: "Campione", cost: 3, power: 5, kind: "none", text: "", lore: "Ha giurato sul Sigillo. Il Sigillo ha risposto." },
    { id: "muretto", house: "guardia", name: "Bastione", cost: 3, power: 4, kind: "anchor", text: "Non si sposta.", lore: "Mille scudi. Nessuna porta.", anchor: true },
    { id: "fabbro", house: "guardia", name: "Fabbro", cost: 3, power: 3, kind: "reveal", text: "La tua carta più forte qui: +3.", lore: "Ha forgiato la corona. Non l'ha mai voluta.", ability: { op: "buff", target: "ally-strong", amount: 3 } },
    { id: "idraulico", house: "guardia", name: "Gigante", cost: 4, power: 6, kind: "none", text: "", lore: "I cavalieri gli arrivano al ginocchio. Lui si inginocchia solo al Sigillo." },
    { id: "pizzaiolo", house: "guardia", name: "Banchetto", cost: 4, power: 3, kind: "reveal", text: "Le tue altre carte qui: +2.", lore: "Si mangia prima della battaglia. Chi torna, finisce il vino.", ability: { op: "buff", target: "ally-all", amount: 2 } },
    { id: "capotreno", house: "guardia", name: "Cacciadraghi", cost: 4, power: 5, kind: "reveal", text: "Attira qui la carta nemica più debole da un'altra rovina.", lore: "La lancia è un dente. Il dente ricorda.", ability: { op: "pull", pick: "low" } },
    { id: "orchestra", house: "guardia", name: "Coro di lame", cost: 5, power: 4, kind: "ongoing", text: "Le tue altre carte qui: +2.", lore: "Tre spade alzate valgono una preghiera.", ability: { op: "aura", target: "ally", amount: 2 } },
    { id: "inviato", house: "guardia", name: "Araldo", cost: 5, power: 6, kind: "reveal", text: "Se all'ora dopo giochi un'altra carta qui: +4.", lore: "Arriva tardi. Porta comunque la guerra.", ability: { op: "promise", amount: 4 } },
    { id: "sindaca", house: "guardia", name: "Regina", cost: 5, power: 8, kind: "none", text: "", lore: "Ha seppellito tre re. Il quarto dorme sotto il Sigillo." },

    // SELVA — chi non ha padrone
    { id: "passero", house: "selva", name: "Passero", cost: 1, power: 1, kind: "reveal", text: "Se è la tua unica carta qui: +3.", lore: "Ha visto cadere tre corone. Non gliene importa.", ability: { op: "buff", target: "self-if-alone", amount: 3 } },
    { id: "ratto", house: "selva", name: "Ratto", cost: 1, power: 0, kind: "ongoing", text: "+1 per ogni altra carta qui, di chiunque.", lore: "Dove c'è un esercito, c'è già lui.", ability: { op: "self", cond: "per-card", amount: 1 } },
    { id: "lupo", house: "selva", name: "Lupo", cost: 2, power: 2, kind: "ongoing", text: "Se è la tua unica carta qui: +3.", lore: "Il branco è un ricordo. Lui è quello che è rimasto.", ability: { op: "self", cond: "alone", amount: 3 } },
    { id: "orso", house: "selva", name: "Orso", cost: 3, power: 2, kind: "ongoing", text: "+2 per ogni nemico qui.", lore: "Si è svegliato di malumore. Più siete, peggio è.", ability: { op: "self", cond: "per-enemy", amount: 2 } },
    { id: "albero", house: "selva", name: "Antico", cost: 3, power: 3, kind: "ongoing", text: "+1 per ogni altra tua carta qui.", lore: "Cammina una volta ogni cento anni. Oggi tocca.", ability: { op: "self", cond: "per-ally", amount: 1 } },
    { id: "piovra", house: "selva", name: "Piovra", cost: 4, power: 2, kind: "ongoing", text: "+1 per ogni altra carta qui, di chiunque.", lore: "Otto braccia. Nessuna resta vuota.", ability: { op: "self", cond: "per-card", amount: 1 } },
    { id: "troll", house: "selva", name: "Troll", cost: 5, power: 5, kind: "reveal", text: "Sposta via da qui la carta nemica più forte.", lore: "Il ponte è suo. Anche il pedaggio.", ability: { op: "move", target: "enemy", amount: 0 } },
    { id: "grifone", house: "selva", name: "Grifone", cost: 5, power: 7, kind: "none", text: "", lore: "Custodisce un oro che non esiste più." },
    { id: "idra", house: "selva", name: "Idra", cost: 5, power: 4, kind: "reveal", text: "+1 per ogni altra carta qui.", lore: "Tagli una testa. Ne conta due.", ability: { op: "buff", target: "self-per-card", amount: 1 } },
    { id: "leviatano", house: "selva", name: "Leviatano", cost: 5, power: 6, kind: "anchor", text: "Non si sposta.", lore: "I porti lo chiamano isola. Pregano che resti addormentato.", anchor: true },
    { id: "basilisco", house: "selva", name: "Basilisco", cost: 6, power: 8, kind: "ongoing", text: "I nemici qui: −1.", lore: "Anche l'erba diventa statua, per educazione.", ability: { op: "aura", target: "enemy", amount: -1 } },
    { id: "kraken", house: "selva", name: "Kraken", cost: 6, power: 7, kind: "ongoing", text: "+1 per ogni nemico qui.", lore: "Quando affiora, le stelle si spostano.", ability: { op: "self", cond: "per-enemy", amount: 1 } },
    { id: "camion", house: "selva", name: "Drago", cost: 6, power: 12, kind: "none", text: "", lore: "Dormiva sotto la piana. Qualcuno ha contato fino a sei." },

    // CONGREGA — chi lega con il sale
    { id: "gatto", house: "congrega", name: "Famiglio", cost: 1, power: 1, kind: "none", text: "Se viene distrutto, torna nella tua mano con +2.", lore: "Nelle cripte conta più di un plotone.", ability: { op: "revive", amount: 2 } },
    { id: "folletto", house: "congrega", name: "Folletto", cost: 1, power: 1, kind: "reveal", text: "Ruba 1 alla carta nemica più forte qui.", lore: "Ride. Poi morde. Poi ride ancora.", ability: { op: "buff", target: "enemy-strong", amount: -1 } },
    { id: "spina", house: "congrega", name: "Spina", cost: 1, power: 0, kind: "ongoing", text: "I nemici qui: −1.", lore: "Cresce nella ferita, non nel giardino.", ability: { op: "aura", target: "enemy", amount: -1 } },
    { id: "nonna", house: "congrega", name: "Matriarca", cost: 2, power: 1, kind: "ongoing", text: "Le tue altre carte qui: +1.", lore: "La corona di radici era sua prima che fosse di ferro.", ability: { op: "aura", target: "ally", amount: 1 } },
    { id: "strega", house: "congrega", name: "Strega", cost: 2, power: 2, kind: "reveal", text: "Tutti i nemici qui: −1.", lore: "Sala il nome dei vivi perché non marciscano.", ability: { op: "buff", target: "enemy-all", amount: -1 } },
    { id: "driade", house: "congrega", name: "Driade", cost: 2, power: 2, kind: "anchor", text: "Non si sposta.", lore: "Se tagli l'albero, lei impara il tuo nome.", anchor: true },
    { id: "gerani", house: "congrega", name: "Rovi", cost: 3, power: 3, kind: "ongoing", text: "I nemici qui: −1.", lore: "Crescono sulle armature, non sulla terra.", ability: { op: "aura", target: "enemy", amount: -1 } },
    { id: "serpe", house: "congrega", name: "Serpe", cost: 3, power: 1, kind: "reveal", text: "Ruba 3 alla carta nemica più forte qui.", lore: "Il veleno è lento. La paura no.", ability: { op: "buff", target: "enemy-strong", amount: -3 } },
    { id: "veggente", house: "congrega", name: "Veggente", cost: 3, power: 1, kind: "reveal", text: "Pesca 2 carte.", lore: "Gli occhi sono chiusi. Il mazzo no.", ability: { op: "draw", amount: 2 } },
    { id: "giullare", house: "congrega", name: "Giullare", cost: 3, power: 4, kind: "none", text: "", lore: "Il re rideva. Poi non c'era più un re." },
    { id: "sguardo", house: "congrega", name: "Sguardo", cost: 4, power: 2, kind: "ongoing", text: "I nemici qui: −2.", lore: "I capelli sono serpi. Gli occhi sono pietra.", ability: { op: "aura", target: "enemy", amount: -2 } },
    { id: "sacerdotessa", house: "congrega", name: "Sacerdotessa", cost: 5, power: 2, kind: "ongoing", text: "Le tue altre carte qui: +3.", lore: "Prega un dio che non risponde. Le basta.", ability: { op: "aura", target: "ally", amount: 3 } },
    { id: "temporale", house: "congrega", name: "Piromante", cost: 6, power: 7, kind: "reveal", text: "Tutti i nemici qui: −2.", lore: "Il fuoco non è suo. Lo ha solo convinto.", ability: { op: "buff", target: "enemy-all", amount: -2 } },

    // TESORO — chi conta le ore
    { id: "lampione", house: "tesoro", name: "Lanterna", cost: 1, power: 1, kind: "ongoing", text: "+1 per ogni nemico qui.", lore: "Brucia grasso di drago. I morti si vedono meglio.", ability: { op: "self", cond: "per-enemy", amount: 1 } },
    { id: "moneta", house: "tesoro", name: "Obolo", cost: 1, power: 0, kind: "reveal", text: "+1 lume all'ora dopo.", lore: "Il traghettatore non dà resto. Dà tempo.", ability: { op: "energy", amount: 1 } },
    { id: "candela", house: "tesoro", name: "Candela", cost: 1, power: 1, kind: "reveal", text: "Pesca una carta.", lore: "Si consuma perché qualcun altro possa vedere.", ability: { op: "draw", amount: 1 } },
    { id: "chiavi", house: "tesoro", name: "Chiavi", cost: 2, power: 2, kind: "reveal", text: "La carta più costosa della tua mano costa 1 in meno.", lore: "Una apre la cripta. Le altre aprono storie.", ability: { op: "discount", amount: 1 } },
    { id: "folata", house: "tesoro", name: "Otre dei venti", cost: 2, power: 1, kind: "reveal", text: "Sposta altrove la tua carta più forte qui e le dà +3.", lore: "Dentro c'è una tempesta. Fuori, la strada.", ability: { op: "move", target: "ally", amount: 3 } },
    { id: "specchio", house: "tesoro", name: "Specchio", cost: 2, power: 1, kind: "reveal", text: "Se qui stai perdendo: +3.", lore: "Mostra il volto che avresti se vincessi.", ability: { op: "buff", target: "self-if-behind", amount: 3 } },
    { id: "espresso", house: "tesoro", name: "Elisir", cost: 3, power: 2, kind: "reveal", text: "+2 lume all'ora dopo.", lore: "Oro e veleno, nella stessa fiala.", ability: { op: "energy", amount: 2 } },
    { id: "poeta", house: "tesoro", name: "Cronista", cost: 3, power: 2, kind: "reveal", text: "Le carte nella tua mano: +1.", lore: "Scrive i nomi di chi cade. I nomi pesano.", ability: { op: "hand", side: "ally", amount: 1 } },
    { id: "campana", house: "tesoro", name: "Campana", cost: 3, power: 2, kind: "reveal", text: "Dalla quinta ora: +5.", lore: "Suona solo quando è troppo tardi per scappare.", ability: { op: "buff", target: "self-if-turn", amount: 5, turn: 5 } },
    { id: "orologio", house: "tesoro", name: "Eclissi", cost: 4, power: 3, kind: "reveal", text: "Dalla quarta ora: +4.", lore: "Quando la luna copre il sole, i patti scadono.", ability: { op: "buff", target: "self-if-turn", amount: 4, turn: 4 } },
    { id: "alchimista", house: "tesoro", name: "Alchimista", cost: 4, power: 4, kind: "reveal", text: "+2 lume all'ora dopo.", lore: "Trasforma il piombo in ore, non in oro.", ability: { op: "energy", amount: 2 } },
    { id: "golem", house: "tesoro", name: "Golem", cost: 4, power: 6, kind: "anchor", text: "Non si sposta.", lore: "Sulla fronte ha una parola. Nessuno osa leggerla.", anchor: true },
    { id: "nave", house: "tesoro", name: "Nave in bottiglia", cost: 5, power: 3, kind: "reveal", text: "Sposta altrove la tua carta più forte qui e le dà +4.", lore: "Il mare è dentro. Per ora.", ability: { op: "move", target: "ally", amount: 4 } },

    // FONDO — chi è già caduto
    { id: "bruma", house: "fondo", name: "Bruma", cost: 1, power: 1, kind: "reveal", text: "Sposta altrove la tua carta più forte qui e le dà +1.", lore: "Al mattino non c'è più. Il freddo resta.", ability: { op: "move", target: "ally", amount: 1 } },
    { id: "spia", house: "fondo", name: "Assassino", cost: 2, power: 1, kind: "reveal", text: "Aggiungi alla tua mano una copia della carta nemica più forte qui.", lore: "Non uccide il re. Gli toglie il nome.", ability: { op: "copy-enemy" } },
    { id: "ladro", house: "fondo", name: "Ladro", cost: 2, power: 2, kind: "reveal", text: "Ruba un lume: all'ora dopo l'Ombra ne ha 1 in meno, tu 1 in più.", lore: "Non ruba oro. Ruba il peso di una vittoria.", ability: { op: "steal-energy", amount: 1 } },
    { id: "corvo", house: "fondo", name: "Corvo", cost: 2, power: 2, kind: "ongoing", text: "+1 per ogni nemico qui.", lore: "Ne basta uno. Gli altri arrivano dopo.", ability: { op: "self", cond: "per-enemy", amount: 1 } },
    { id: "pirata", house: "fondo", name: "Pirata", cost: 2, power: 1, kind: "ongoing", text: "Alla fine di ogni ora: +1.", lore: "Ha venduto la nave. Ha tenuto la mappa.", ability: { op: "grow", amount: 1 } },
    { id: "spettro", house: "fondo", name: "Spettro", cost: 3, power: 2, kind: "reveal", text: "Sposta altrove la tua carta più forte qui e le dà +3.", lore: "Attraversa il muro e si porta dietro un vivo.", ability: { op: "move", target: "ally", amount: 3 } },
    { id: "cacciatrice", house: "fondo", name: "Cacciatrice", cost: 3, power: 3, kind: "reveal", text: "Sposta via da qui la carta nemica più forte.", lore: "Non insegue prede. Insegue promesse rotte.", ability: { op: "move", target: "enemy", amount: 0 } },
    { id: "sete", house: "fondo", name: "Sete", cost: 4, power: 4, kind: "reveal", text: "Ruba 2 alla carta nemica più forte qui.", lore: "Beve il coraggio, non il vino.", ability: { op: "buff", target: "enemy-strong", amount: -2 } },
    { id: "fenice", house: "fondo", name: "Fenice", cost: 4, power: 3, kind: "reveal", text: "Se qui stai perdendo: +5.", lore: "Muore per abitudine. Torna per dispetto.", ability: { op: "buff", target: "self-if-behind", amount: 5 } },
    { id: "sepolto", house: "fondo", name: "Re sepolto", cost: 5, power: 6, kind: "reveal", text: "Se qui stai perdendo: +4.", lore: "La corona è sotto terra. Il rancore no.", ability: { op: "buff", target: "self-if-behind", amount: 4 } },
    { id: "piaga", house: "fondo", name: "Piaga", cost: 5, power: 4, kind: "ongoing", text: "Alla fine di ogni ora, i nemici qui: −1.", lore: "Non uccide. Fa dimenticare perché si combatteva.", ability: { op: "poison", amount: 1 } },
    { id: "caduta", house: "fondo", name: "Caduta", cost: 6, power: 9, kind: "none", text: "", lore: "Non è un angelo. È quello che resta dopo." },
    { id: "titano", house: "fondo", name: "Il Dormiente", cost: 6, power: 10, kind: "anchor", text: "Non si sposta.", lore: "È lui che il Sigillo tiene giù. Ogni tanto si gira nel sonno.", anchor: true }
  ];

  /*
   * Espansione «Il Risveglio» (vedi ESPANSIONE.md), attiva dal 13 nov 2026.
   * Si ottiene come le altre carte (premi, Bottega, pass) e si mette nel
   * proprio mazzo. I mazzi casuali (l'Ombra, la notte di oggi) restano sul
   * set base: così la notte di oggi è uguale per tutti e il bilanciamento
   * misurato resta valido.
   */
  var EXPANSION = [
    // GUARDIA — Schiera
    { id: "alfiere", house: "guardia", set: "risveglio", name: "Alfiere", cost: 2, power: 1, kind: "ongoing", text: "Le tue carte nelle rovine accanto: +1.", lore: "Dove sventola, nessuno arretra di un passo.", ability: { op: "aura", target: "ally-adjacent", amount: 1 } },
    { id: "sentinella", house: "guardia", set: "risveglio", name: "Sentinella del ponte", cost: 1, power: 1, kind: "reveal", text: "Se qui hai più carte dell'Ombra: +2.", lore: "Conta i compagni prima di contare i nemici.", ability: { op: "buff", target: "self-if-more-cards", amount: 2 } },
    { id: "cappellano", house: "guardia", set: "risveglio", name: "Cappellano", cost: 3, power: 3, kind: "ongoing", text: "Le tue altre carte qui: +1, e nessuno può spostarle.", lore: "Benedice i piedi, non le spade. I piedi restano.", ability: { op: "aura", target: "ally", amount: 1, protect: true } },
    { id: "testuggine", house: "guardia", set: "risveglio", name: "Testuggine", cost: 4, power: 3, kind: "ongoing", text: "Se qui hai 3 o più carte: +5.", lore: "Cento scudi, una sola schiena.", ability: { op: "self", cond: "crowd", min: 3, amount: 5 } },
    { id: "re_vincolato", house: "guardia", set: "risveglio", name: "Il Re vincolato", cost: 6, power: 4, kind: "reveal", text: "Le tue carte nelle rovine accanto: +2.", lore: "Ha giurato sul Sigillo con il sangue. Il Sigillo non dimentica i debiti.", ability: { op: "buff", target: "ally-adjacent-all", amount: 2 } },
    // SELVA — Covata
    { id: "cucciolata", house: "selva", set: "risveglio", name: "Cucciolata", cost: 1, power: 1, kind: "reveal", text: "Aggiungi un Ratto alla tua mano.", lore: "Uno è un fastidio. Sette sono un esercito.", ability: { op: "summon", ids: ["ratto"] } },
    { id: "cinghiale", house: "selva", set: "risveglio", name: "Cinghiale", cost: 3, power: 4, kind: "reveal", text: "Sposta via da qui la carta nemica più debole.", lore: "Non sceglie il nemico più grande. Sceglie quello che cade meglio.", ability: { op: "move", target: "enemy", pick: "low", amount: 0 } },
    { id: "capobranco", house: "selva", set: "risveglio", name: "Capobranco", cost: 3, power: 3, kind: "ongoing", text: "+1 per ogni altra tua carta della Selva sul tavolo.", lore: "Non ulula per sé. Ulula perché gli altri sappiano dov'è.", ability: { op: "self", cond: "per-house", amount: 1 } },
    { id: "madre_bestie", house: "selva", set: "risveglio", name: "Madre delle bestie", cost: 4, power: 6, kind: "reveal", text: "Aggiungi un Lupo e un Corvo alla tua mano.", lore: "Ogni tana della valle porta il suo nome.", ability: { op: "summon", ids: ["lupo", "corvo"] } },
    { id: "mammut", house: "selva", set: "risveglio", name: "Mammut del gelo", cost: 6, power: 9, kind: "ongoing", text: "Le carte nemiche da 1 e 2 lumi qui: −2.", lore: "Era sotto il ghiaccio prima che ci fosse la valle.", ability: { op: "aura", target: "enemy", amount: -2, maxCost: 2 } },
    // CONGREGA — Patto
    { id: "bambola", house: "congrega", set: "risveglio", name: "Bambola di pezza", cost: 1, power: 0, kind: "reveal", text: "Le carte nella mano dell'Ombra: −1.", lore: "Ha i tuoi capelli. Chi gliel'ha dati?", ability: { op: "hand", side: "enemy", amount: -1 } },
    { id: "cerchio_sale", house: "congrega", set: "risveglio", name: "Cerchio di sale", cost: 2, power: 0, kind: "reveal", text: "Sigilla questa rovina: da ora nessuno può più giocarci.", lore: "Dentro, nessuno entra. Fuori, nessuno dorme.", ability: { op: "seal" } },
    { id: "strega_pozzo", house: "congrega", set: "risveglio", name: "Strega del pozzo", cost: 2, power: 2, kind: "reveal", text: "Riporta in mano la tua carta più debole qui.", lore: "Ti tira giù per farti risalire. Di solito.", ability: { op: "bounce" } },
    { id: "specchio_nero", house: "congrega", set: "risveglio", name: "Specchio nero", cost: 3, power: 1, kind: "reveal", text: "Prende la forza della carta nemica più forte qui.", lore: "Non riflette il volto. Riflette quanto pesa.", ability: { op: "buff", target: "copy-strong" } },
    { id: "madre_strega", house: "congrega", set: "risveglio", name: "La Madre strega", cost: 6, power: 3, kind: "ongoing", text: "Le tue altre carte, in ogni rovina: +1.", lore: "Tutte le streghe della valle hanno imparato il sale da lei.", ability: { op: "aura", target: "ally-global", amount: 1 } },
    // TESORO — Riserva
    { id: "clessidra", house: "tesoro", set: "risveglio", name: "Clessidra", cost: 2, power: 0, kind: "reveal", text: "+3 lumi all'ora dopo.", lore: "Non ferma il tempo. Lo mette da parte.", ability: { op: "energy", amount: 3 } },
    { id: "scrigno", house: "tesoro", set: "risveglio", name: "Scrigno sigillato", cost: 2, power: 0, kind: "ongoing", text: "Dalla quinta ora: +5.", lore: "Si apre da solo. Basta aspettare abbastanza.", ability: { op: "self", cond: "from-turn", turn: 5, amount: 5 } },
    { id: "astrolabio", house: "tesoro", set: "risveglio", name: "Astrolabio", cost: 3, power: 3, kind: "reveal", text: "Pesca la carta più costosa del tuo mazzo.", lore: "Indica la stella più lontana. Di solito è quella giusta.", ability: { op: "draw-best" } },
    { id: "corona_spezzata", house: "tesoro", set: "risveglio", name: "Corona spezzata", cost: 4, power: 4, kind: "reveal", text: "Se il pegno è stato alzato: +4.", lore: "Chi osa di più la porta. Chi la porta, osa di più.", ability: { op: "buff", target: "self-if-stake", amount: 4 } },
    { id: "reliquiario", house: "tesoro", set: "risveglio", name: "Reliquiario", cost: 4, power: 3, kind: "ongoing", text: "+1 per ogni carta che hai in mano.", lore: "Custodisce ossa di santi. Nessuno ricorda quali.", ability: { op: "self", cond: "per-hand", amount: 1 } },
    // FONDO — Rovina
    { id: "becchino", house: "fondo", set: "risveglio", name: "Becchino", cost: 2, power: 1, kind: "reveal", text: "Distruggi la carta nemica più debole qui.", lore: "Scava sempre una fossa in più. Per sicurezza.", ability: { op: "destroy", target: "enemy-weak" } },
    { id: "necromante", house: "fondo", set: "risveglio", name: "Necromante", cost: 3, power: 3, kind: "reveal", text: "Aggiungi due Bruma alla tua mano.", lore: "Non risveglia i morti. Li invita.", ability: { op: "summon", ids: ["bruma", "bruma"] } },
    { id: "banshee", house: "fondo", set: "risveglio", name: "Banshee", cost: 3, power: 3, kind: "reveal", text: "Distruggi tutte le carte qui con forza 1 o meno, anche le tue.", lore: "Il suo grido non uccide i forti. Ai deboli basta.", ability: { op: "destroy", target: "all-weak", max: 1 } },
    { id: "senza_testa", house: "fondo", set: "risveglio", name: "Cavaliere senza testa", cost: 5, power: 6, kind: "reveal", text: "Distruggi la carta nemica più forte qui, se ha forza 6 o meno.", lore: "Ha perso la testa, non la mira.", ability: { op: "destroy", target: "enemy-strong", max: 6 } },
    { id: "traghettatore", house: "fondo", set: "risveglio", name: "Il Traghettatore", cost: 6, power: 10, kind: "ongoing", text: "+2 per ogni carta distrutta in questa notte.", lore: "Accetta l'obolo. Poi accetta tutto il resto.", ability: { op: "self", cond: "per-destroyed", amount: 2 } }
  ];

  var LOCATIONS = [
    { id: "fontana", name: "Fonte di luna", text: "Tutte le carte qui: +1.", lore: "L'acqua ricorda chi eri. Per un'ora, lo sei di nuovo.", flat: 1 },
    { id: "bar", name: "Mercato d'ombra", text: "Le carte costano 1 in meno (minimo 1).", lore: "Si paga dopo. Sempre dopo.", discount: 1 },
    { id: "panchina", name: "Strettoia", text: "Solo 3 carte per lato.", lore: "Due rocce, un sentiero. Uno passa, l'altro aspetta.", maxCards: 3 },
    { id: "forno", name: "Forgia", text: "La prima carta che scopri qui: +3.", lore: "Il primo colpo tempra. Gli altri fanno rumore.", firstBonus: 3 },
    { id: "mercato", name: "Campo d'ossa", text: "Chi ha più carte qui: +4.", lore: "Qui vince il numero. I nomi li conta qualcun altro.", moreCards: 4 },
    { id: "vicolo", name: "Cripta del Silenzio", text: "Le abilità Sempre qui sono spente.", lore: "Nemmeno le preghiere fanno eco.", suppressOngoing: true },
    { id: "terrazza", name: "Torrione", text: "Dalla quinta ora non si gioca più qui.", lore: "Al tramonto alzano il ponte. Chi è fuori, resta fuori.", lockTurn: 5 },
    { id: "piazza", name: "Piana del drago", text: "La potenza qui raddoppia.", lore: "Il terreno è caldo. Qualcosa respira sotto.", double: true },
    { id: "orto", name: "Cimitero", text: "Chi ha meno carte qui: +5.", lore: "I pochi pesano di più. Chiedi ai morti.", fewerCards: 5 },
    { id: "balcone", name: "Nido", text: "Le carte da 1 e 2 lumi qui: +2.", lore: "Lassù i piccoli sono re.", cheapBoost: 2 },
    { id: "cantiere", name: "Palude", text: "Tutte le carte qui: −1.", lore: "Affonda tutto. Lentamente, ma tutto.", tax: 1 },
    { id: "osteria", name: "Taverna", text: "Alla quarta ora tutti pescano una carta in più.", lore: "Una storia in più, un bicchiere in più.", extraDrawTurn: 4 },
    { id: "semaforo", name: "Campanile", text: "Qui le carte si scoprono per ultime.", lore: "Il campanaro aspetta. Poi suona per tutti.", revealLast: true }
  ];

  var LINES = [
    "L'Ombra gioca le tue stesse carte. È questo che fa paura.",
    "Il Dormiente si gira nel sonno. Il Sigillo scricchiola.",
    "Sei ore. Poi la campana decide.",
    "Due rovine bastano. Tre sono un messaggio.",
    "Chi rilancia per primo scopre per primo cosa teme."
  ];

  var REASONS = {
    fase: "Non è ancora il tempo.",
    mano: "Quella carta non è fra le tue dita.",
    banco: "Nessuna rovina sorge laggiù.",
    chiuso: "Il ponte è alzato: questa rovina è chiusa.",
    pieno: "Tra queste pietre non c'è più posto.",
    energia: "I tuoi lumi non bastano.",
    tenuto: "È appena giunta a te: potrai giocarla all'ora che viene.",
    gia: "Hai già alzato il pegno, stanotte.",
    vuoto: "Non c'è nulla da riprendere."
  };

  var ORE = ["Prima", "Seconda", "Terza", "Quarta", "Quinta", "Sesta"];

  var BY_HOUSE = Object.create(null);
  HOUSES.forEach(function (h) { BY_HOUSE[h.id] = h; });

  // Tutte le carte che si possono possedere: set base più espansioni attive.
  var ALL_CARDS = CARDS.concat(EXPANSION);

  var BY_CARD = Object.create(null);
  var BY_LOC = Object.create(null);
  ALL_CARDS.forEach(function (c) { BY_CARD[c.id] = c; });
  LOCATIONS.forEach(function (l) { BY_LOC[l.id] = l; });

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(text) {
    var h = 2166136261;
    var s = String(text);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function dailySeed(dateStr) {
    return hashString("lume-v1|" + dateStr);
  }

  function todayKey(date) {
    var d = date || new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function shuffle(list, rng) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function other(side) {
    return side === "you" ? "rival" : "you";
  }

  function sideName(side) {
    return side === "you" ? "Custode" : "Ombra";
  }

  function fail(reason) {
    return { ok: false, reason: reason, message: REASONS[reason] || "Il Sigillo non lo concede." };
  }

  function lanesOf(state) {
    var out = [];
    for (var i = 0; i < state.locations.length; i++) out.push(i);
    return out;
  }

  function emptyPlayer(lanes) {
    var board = [];
    for (var i = 0; i < (lanes || 3); i++) board.push([]);
    return {
      deck: [],
      hand: [],
      board: board,
      staged: [],
      limbo: {},
      energyLeft: 0,
      nextEnergy: 0
    };
  }

  function instantiate(state, def, owner) {
    var n = state.seq++;
    // Nel PvP il prefisso è il posto al tavolo (h/g), uguale sui due computer.
    var tag = state.seats ? state.seats[owner] : owner;
    return {
      uid: tag + "-" + n,
      id: def.id,
      house: def.house || "",
      name: def.name,
      cost: def.cost,
      power: def.power,
      text: def.text,
      lore: def.lore || "",
      kind: def.kind,
      ability: def.ability ? Object.assign({}, def.ability) : null,
      anchor: !!def.anchor,
      owner: owner,
      bonus: 0,
      revealed: false,
      hold: false
    };
  }

  function instanceLocation(def) {
    return {
      id: def.id,
      name: def.name,
      text: def.text,
      lore: def.lore || "",
      flat: def.flat || 0,
      discount: def.discount || 0,
      maxCards: def.maxCards || LANE_MAX,
      firstBonus: def.firstBonus || 0,
      moreCards: def.moreCards || 0,
      fewerCards: def.fewerCards || 0,
      suppressOngoing: !!def.suppressOngoing,
      lockTurn: def.lockTurn || 0,
      double: !!def.double,
      cheapBoost: def.cheapBoost || 0,
      tax: def.tax || 0,
      extraDrawTurn: def.extraDrawTurn || 0,
      revealLast: !!def.revealLast,
      sealed: false,
      first: { you: null, rival: null }
    };
  }

  function pushFeed(state, line) {
    state.feed.push(line);
    if (state.feed.length > 16) state.feed.shift();
  }

  function drawN(player, n, hold) {
    var drew = 0;
    while (drew < n && player.deck.length && player.hand.length < HAND_MAX) {
      var card = player.deck.pop();
      card.hold = !!hold;
      player.hand.push(card);
      drew++;
    }
    return drew;
  }

  /*
   * Il mazzo segue sempre la stessa curva di costi. Con una casata scelta,
   * circa due carte su tre vengono da quella casata (dove ce ne sono).
   */
  function buildDeck(state, owner, rng, house, pool) {
    var byCost = {};
    (pool || CARDS).forEach(function (c) {
      if (!byCost[c.cost]) byCost[c.cost] = [];
      byCost[c.cost].push(c);
    });
    var targets = { 1: 2, 2: 3, 3: 3, 4: 2, 5: 1, 6: 1 };
    var picked = [];
    [1, 2, 3, 4, 5, 6].forEach(function (cost) {
      var pool = shuffle(byCost[cost], rng);
      if (house) {
        var mine = pool.filter(function (c) { return c.house === house; });
        var rest = pool.filter(function (c) { return c.house !== house; });
        var quota = Math.min(mine.length, Math.round(targets[cost] / 2 + 0.01));
        pool = mine.slice(0, quota).concat(rest, mine.slice(quota));
      }
      for (var i = 0; i < targets[cost]; i++) picked.push(pool[i]);
    });
    return shuffle(picked, rng).map(function (def) {
      return instantiate(state, def, owner);
    });
  }

  var DECK_SIZE = 12;

  // Restituisce la lista se è un mazzo valido: 12 carte esistenti, tutte diverse.
  function deckList(ids) {
    if (!Array.isArray(ids) || ids.length !== DECK_SIZE) return null;
    var seen = Object.create(null);
    for (var i = 0; i < ids.length; i++) {
      if (!BY_CARD[ids[i]] || seen[ids[i]]) return null;
      seen[ids[i]] = true;
    }
    return ids.slice();
  }

  function deckFromIds(state, owner, rng, ids) {
    // Ordino prima per id, così lo stesso mazzo mescolato con lo stesso seme dà sempre lo stesso ordine.
    var defs = ids.slice().sort().map(function (id) { return BY_CARD[id]; });
    return shuffle(defs, rng).map(function (def) { return instantiate(state, def, owner); });
  }

  function pickLocations(rng, n) {
    return shuffle(LOCATIONS, rng).slice(0, n || 3).map(instanceLocation);
  }

  /*
   * Livelli dell'IA. beam/depth: quanto guarda avanti. slip: probabilità di
   * scegliere una mossa a caso invece della migliore. bonus: lumi in più
   * all'Ombra dall'ora indicata. extraCard: carte in più all'inizio.
   * awakened: l'Ombra pesca anche dalle carte del Risveglio (livelli avanzati).
   */
  var AI_LEVELS = {
    0: { beam: 1, depth: 1, slip: 0.7, bonus: 0, bonusFrom: 0, extraCard: 0, snaps: false }, // l'Ombra assopita: solo le prime tappe
    1: { beam: 1, depth: 1, slip: 0.45, bonus: 0, bonusFrom: 0, extraCard: 0, snaps: false },
    2: { beam: 2, depth: 2, slip: 0.25, bonus: 0, bonusFrom: 0, extraCard: 0, snaps: false },
    3: { beam: 3, depth: 2, slip: 0.1, bonus: 0, bonusFrom: 0, extraCard: 0, snaps: true },
    4: { beam: 4, depth: 3, slip: 0, bonus: 0, bonusFrom: 0, extraCard: 0, snaps: true },
    5: { beam: 4, depth: 3, slip: 0, bonus: 1, bonusFrom: 4, extraCard: 0, snaps: true, awakened: true },
    6: { beam: 5, depth: 3, slip: 0, bonus: 1, bonusFrom: 3, extraCard: 1, snaps: true, awakened: true },
    7: { beam: 6, depth: 3, slip: 0, bonus: 1, bonusFrom: 2, extraCard: 1, snaps: true, awakened: true }
  };

  function ensureOpening(player) {
    if (player.hand.some(function (c) { return c.cost <= 1; })) return;
    var idx = -1;
    for (var i = 0; i < player.deck.length; i++) {
      if (player.deck[i].cost <= 1) { idx = i; break; }
    }
    if (idx < 0 || !player.hand.length) return;
    var card = player.deck.splice(idx, 1)[0];
    player.deck.push(player.hand.pop());
    player.hand.push(card);
  }

  function createMatch(opts) {
    opts = opts || {};
    var daily = !!opts.daily;
    var date = opts.date || (daily ? todayKey() : null);
    var seed = opts.seed;
    if (daily) seed = dailySeed(date);
    if (seed == null) seed = (Math.random() * 0x100000000) >>> 0;
    seed = seed >>> 0;
    var controlled = Object.prototype.hasOwnProperty.call(opts, "youHand");
    var rng = mulberry32(seed);
    var lanes = Math.max(3, Math.min(5, opts.lanes || 3));
    var seat = opts.seat === "host" || opts.seat === "guest" ? opts.seat : null;
    var aiLevel = AI_LEVELS[opts.aiLevel] ? opts.aiLevel : 4;
    var level = AI_LEVELS[aiLevel];
    var house = opts.house && BY_HOUSE[opts.house] ? opts.house : null;
    var rivalHouse = opts.rivalHouse && BY_HOUSE[opts.rivalHouse] ? opts.rivalHouse : null;
    if (house && !rivalHouse && !seat) {
      var others = HOUSES.filter(function (h) { return h.id !== house; });
      rivalHouse = others[hashString("ombra|" + seed) % others.length].id;
    }
    // Nel PvP il lancio della moneta è dell'host: l'ospite lo vede rovesciato.
    var hostFirst = rng() < 0.5;
    var firstSide = seat === "guest" ? (hostFirst ? "rival" : "you") : (hostFirst ? "you" : "rival");
    var state = {
      seed: seed,
      daily: daily,
      date: date,
      house: house,
      rivalHouse: rivalHouse,
      mode: seat ? "pvp" : opts.mode || "solo",
      seat: seat,
      seats: seat ? (seat === "host" ? { you: "h", rival: "g" } : { you: "g", rival: "h" }) : null,
      aiLevel: aiLevel,
      aiCfg: level,
      turn: 0,
      phase: "plan",
      priority: firstSide,
      stake: 1,
      youSnapped: false,
      rivalSnapped: false,
      retreated: null,
      winner: null,
      reason: null,
      maxEnergy: 0,
      locations: [],
      you: emptyPlayer(lanes),
      rival: emptyPlayer(lanes),
      feed: [],
      queue: [],
      fresh: [],
      revealLog: [],
      destroyed: 0,
      seq: 1,
      ai: seat ? false : controlled ? opts.ai === true : opts.ai !== false,
      line: LINES[seed % LINES.length]
    };

    if (opts.locations) {
      state.locations = opts.locations.map(function (id) {
        if (!BY_LOC[id]) throw new Error("Banco sconosciuto: " + id);
        return instanceLocation(BY_LOC[id]);
      });
    } else {
      state.locations = pickLocations(rng, lanes);
    }
    if (state.locations.length !== state.you.board.length) {
      state.you = emptyPlayer(state.locations.length);
      state.rival = emptyPlayer(state.locations.length);
    }

    if (controlled) {
      state.turn = opts.turn || 1;
      state.maxEnergy = state.turn;
      (opts.youHand || []).forEach(function (id) {
        if (!BY_CARD[id]) throw new Error("Carta sconosciuta: " + id);
        state.you.hand.push(instantiate(state, BY_CARD[id], "you"));
      });
      (opts.youDeck || []).forEach(function (id) {
        if (!BY_CARD[id]) throw new Error("Carta sconosciuta: " + id);
        state.you.deck.push(instantiate(state, BY_CARD[id], "you"));
      });
      (opts.rivalHand || []).forEach(function (id) {
        if (!BY_CARD[id]) throw new Error("Carta sconosciuta: " + id);
        state.rival.hand.push(instantiate(state, BY_CARD[id], "rival"));
      });
      (opts.rivalDeck || []).forEach(function (id) {
        if (!BY_CARD[id]) throw new Error("Carta sconosciuta: " + id);
        state.rival.deck.push(instantiate(state, BY_CARD[id], "rival"));
      });
      state.you.energyLeft = opts.energy != null ? opts.energy : state.turn;
      state.rival.energyLeft = opts.rivalEnergy != null ? opts.rivalEnergy : state.turn;
      state.phase = "plan";
      if (state.ai) {
        planRival(state);
        afterPlan(state);
      }
      return state;
    }

    // Un mazzo scelto dal giocatore (12 carte diverse) vince sul mazzo a caso della casata.
    var lists = { you: deckList(opts.deck), rival: deckList(opts.rivalDeck) };
    var make = function (side, houseId) {
      if (lists[side]) return deckFromIds(state, side, rng, lists[side]);
      // Ai livelli avanzati l'Ombra conosce anche le carte del Risveglio.
      var pool = side === "rival" && !seat && level.awakened ? ALL_CARDS : CARDS;
      return buildDeck(state, side, rng, houseId, pool);
    };
    if (seat) {
      // Ordine fisso: prima il mazzo dell'host, poi quello dell'ospite. Così i due computer coincidono.
      var hostSide = seat === "host" ? "you" : "rival";
      var guestSide = seat === "host" ? "rival" : "you";
      state[hostSide].deck = make(hostSide, state[hostSide === "you" ? "house" : "rivalHouse"]);
      state[guestSide].deck = make(guestSide, state[guestSide === "you" ? "house" : "rivalHouse"]);
    } else {
      state.you.deck = make("you", house);
      state.rival.deck = make("rival", rivalHouse);
    }
    drawN(state.you, 3, false);
    drawN(state.rival, 3 + (state.ai ? level.extraCard : 0), false);
    beginTurn(state);
    return state;
  }

  function beginTurn(state) {
    state.turn += 1;
    state.maxEnergy = state.turn;
    state.you.energyLeft = Math.max(0, state.turn + (state.you.nextEnergy || 0));
    state.rival.energyLeft = Math.max(0, state.turn + (state.rival.nextEnergy || 0));
    var cfg = state.aiCfg;
    if (state.ai && cfg && cfg.bonus && cfg.bonusFrom && state.turn >= cfg.bonusFrom) state.rival.energyLeft += cfg.bonus;
    state.you.nextEnergy = 0;
    state.rival.nextEnergy = 0;
    if (state.locations.some(function (l) { return l.extraDrawTurn === state.turn; })) {
      drawN(state.you, 1, false);
      drawN(state.rival, 1, false);
      pushFeed(state, "Alla Taverna si raccontano storie: tutti pescano una carta in più.");
    }
    drawN(state.you, 1, false);
    drawN(state.rival, 1, false);
    state.you.hand.forEach(function (c) { c.hold = false; });
    state.rival.hand.forEach(function (c) { c.hold = false; });
    if (state.turn === 1) {
      ensureOpening(state.you);
      ensureOpening(state.rival);
    }
    state.phase = "plan";
    state.queue = [];
    pushFeed(state, "Rintocca la " + ORE[state.turn - 1].toLowerCase() + " ora. " + (state.you.energyLeft === 1 ? "Arde un solo lume per te." : "Ardono " + state.you.energyLeft + " lumi per te."));
    if (state.ai && state.phase === "plan") {
      planRival(state);
      afterPlan(state);
    }
  }

  function playCost(state, card, locIndex) {
    var cost = card.cost - (card.cut || 0);
    var loc = state.locations[locIndex];
    if (loc && loc.discount) cost -= loc.discount;
    return Math.max(1, cost);
  }

  // Una rovina è chiusa dal Torrione (quinta ora) o da un Cerchio di sale.
  function isClosed(state, loc) {
    return !!(loc.sealed || (loc.lockTurn && state.turn >= loc.lockTurn));
  }

  function canPlay(state, side, uid, locIndex) {
    if (!state || state.phase !== "plan" || state.winner) return false;
    var player = state[side];
    if (!player) return false;
    var card = null;
    for (var i = 0; i < player.hand.length; i++) {
      if (player.hand[i].uid === uid) { card = player.hand[i]; break; }
    }
    if (!card || card.hold) return false;
    var loc = state.locations[locIndex];
    if (!loc) return false;
    if (isClosed(state, loc)) return false;
    var used = player.board[locIndex].length;
    for (var s = 0; s < player.staged.length; s++) {
      if (player.staged[s].location === locIndex) used++;
    }
    if (used >= (loc.maxCards || LANE_MAX)) return false;
    if (player.energyLeft < playCost(state, card, locIndex)) return false;
    return true;
  }

  function legal(state, uid) {
    return lanesOf(state).map(function (i) { return canPlay(state, "you", uid, i); });
  }

  function quote(state, uid) {
    var card = state && state.you.hand.find(function (c) { return c.uid === uid; });
    return lanesOf(state).map(function (i) {
      return {
        ok: canPlay(state, "you", uid, i),
        paid: card ? playCost(state, card, i) : null
      };
    });
  }

  function stage(state, side, uid, locIndex) {
    if (!canPlay(state, side, uid, locIndex)) {
      var player0 = state && state[side];
      var card0 = player0 && player0.hand.find(function (c) { return c.uid === uid; });
      var loc = state && state.locations[locIndex];
      if (!state || state.phase !== "plan") return fail("fase");
      if (!card0) return fail("mano");
      if (card0.hold) return fail("tenuto");
      if (!loc) return fail("banco");
      if (isClosed(state, loc)) return fail("chiuso");
      var used = player0.board[locIndex].length + player0.staged.filter(function (p) { return p.location === locIndex; }).length;
      if (used >= (loc.maxCards || LANE_MAX)) return fail("pieno");
      return fail("energia");
    }
    var player = state[side];
    var idx = player.hand.findIndex(function (c) { return c.uid === uid; });
    var card = player.hand[idx];
    var paid = playCost(state, card, locIndex);
    player.hand.splice(idx, 1);
    player.limbo[uid] = card;
    player.staged.push({ uid: uid, location: locIndex, paid: paid, index: idx });
    player.energyLeft -= paid;
    return { ok: true, paid: paid };
  }

  function play(state, uid, locIndex) {
    return stage(state, "you", uid, locIndex);
  }

  function unstage(state, uid) {
    if (!state || state.phase !== "plan") return fail("fase");
    var staged = state.you.staged;
    var idx = uid ? staged.findIndex(function (s) { return s.uid === uid; }) : staged.length - 1;
    if (idx < 0) return fail("vuoto");
    var removed = staged.splice(idx, 1)[0];
    var card = state.you.limbo[removed.uid];
    delete state.you.limbo[removed.uid];
    var at = Math.min(removed.index, state.you.hand.length);
    state.you.hand.splice(at, 0, card);
    state.you.energyLeft += removed.paid;
    return { ok: true };
  }

  function undo(state) {
    return unstage(state);
  }

  function findCard(state, uid) {
    var sides = ["you", "rival"];
    for (var s = 0; s < sides.length; s++) {
      var side = sides[s];
      for (var i = 0; i < state.locations.length; i++) {
        var board = state[side].board[i];
        for (var c = 0; c < board.length; c++) {
          if (board[c].uid === uid) return { card: board[c], side: side, location: i };
        }
      }
    }
    return null;
  }

  function cardPower(state, card, locIndex) {
    var loc = state.locations[locIndex];
    var p = card.power + (card.bonus || 0);
    if (loc.flat) p += loc.flat;
    if (loc.tax) p -= loc.tax;
    if (loc.cheapBoost && card.cost <= 2) p += loc.cheapBoost;
    if (!loc.suppressOngoing && card.revealed) {
      p += selfOngoing(state, card, locIndex);
      p += aurasOn(state, card, locIndex);
    }
    return p;
  }

  function selfOngoing(state, card, locIndex) {
    if (!card.revealed || !card.ability || card.ability.op !== "self") return 0;
    if (state.locations[locIndex].suppressOngoing) return 0;
    var mine = state[card.owner].board[locIndex];
    var enemies = state[other(card.owner)].board[locIndex];
    if (card.ability.cond === "alone") return mine.length === 1 ? card.ability.amount : 0;
    if (card.ability.cond === "per-enemy") {
      var n = 0;
      for (var i = 0; i < enemies.length; i++) if (enemies[i].revealed) n++;
      return n * card.ability.amount;
    }
    if (card.ability.cond === "per-ally") {
      var a = 0;
      for (var j = 0; j < mine.length; j++) {
        if (mine[j].uid !== card.uid && mine[j].revealed) a++;
      }
      return a * card.ability.amount;
    }
    if (card.ability.cond === "per-card") {
      var all = 0;
      var lane = mine.concat(enemies);
      for (var k = 0; k < lane.length; k++) {
        if (lane[k].uid !== card.uid && lane[k].revealed) all++;
      }
      return all * card.ability.amount;
    }
    var ab = card.ability;
    if (ab.cond === "crowd") return mine.length >= (ab.min || 3) ? ab.amount : 0;
    if (ab.cond === "from-turn") return state.turn >= ab.turn ? ab.amount : 0;
    if (ab.cond === "per-hand") return state[card.owner].hand.length * ab.amount;
    if (ab.cond === "per-destroyed") return (state.destroyed || 0) * ab.amount;
    if (ab.cond === "per-house") {
      var kin = 0;
      var board = state[card.owner].board;
      for (var l = 0; l < board.length; l++) {
        for (var m = 0; m < board[l].length; m++) {
          var c = board[l][m];
          if (c.uid !== card.uid && c.revealed && c.house === card.house) kin++;
        }
      }
      return kin * ab.amount;
    }
    return 0;
  }

  function aurasOn(state, card, locIndex) {
    if (!card.revealed || state.locations[locIndex].suppressOngoing) return 0;
    var bonus = 0;
    var all = state.you.board[locIndex].concat(state.rival.board[locIndex]);
    for (var i = 0; i < all.length; i++) {
      var otherCard = all[i];
      if (otherCard.uid === card.uid || !otherCard.revealed || !otherCard.ability) continue;
      if (otherCard.ability.op !== "aura") continue;
      var oa = otherCard.ability;
      if ((oa.target === "ally" || oa.target === "ally-global") && otherCard.owner === card.owner) bonus += oa.amount;
      if (oa.target === "enemy" && otherCard.owner !== card.owner && (!oa.maxCost || card.cost <= oa.maxCost)) bonus += oa.amount;
    }
    // Schiera e Madre strega: aure che arrivano da altre rovine.
    var mineBoard = state[card.owner].board;
    for (var j = 0; j < mineBoard.length; j++) {
      if (j === locIndex || state.locations[j].suppressOngoing) continue;
      for (var k = 0; k < mineBoard[j].length; k++) {
        var src = mineBoard[j][k];
        if (!src.revealed || !src.ability || src.ability.op !== "aura") continue;
        if (src.ability.target === "ally-global") bonus += src.ability.amount;
        if (src.ability.target === "ally-adjacent" && Math.abs(j - locIndex) === 1) bonus += src.ability.amount;
      }
    }
    return bonus;
  }

  // Una carta non si sposta se è Ferma o se un Cappellano scoperto la protegge.
  function isFixed(state, card, locIndex) {
    if (card.anchor) return true;
    if (locIndex == null || state.locations[locIndex].suppressOngoing) return false;
    var mine = state[card.owner].board[locIndex] || [];
    for (var i = 0; i < mine.length; i++) {
      var c = mine[i];
      if (c.revealed && c.ability && c.ability.protect) return true;
    }
    return false;
  }

  function laneOf(state, card) {
    var board = state[card.owner].board;
    for (var i = 0; i < board.length; i++) {
      for (var j = 0; j < board[i].length; j++) if (board[i][j].uid === card.uid) return i;
    }
    return -1;
  }

  function destroyCard(state, target, locIndex, by) {
    var lane = state[target.owner].board[locIndex];
    var idx = lane.findIndex(function (c) { return c.uid === target.uid; });
    if (idx < 0) return false;
    lane.splice(idx, 1);
    state.destroyed = (state.destroyed || 0) + 1;
    pushFeed(state, by.name + " distrugge " + target.name + ".");
    var back = target.ability && target.ability.op === "revive" ? state[target.owner] : null;
    if (back && back.hand.length < HAND_MAX) {
      target.revive = (target.revive || 0) + (target.ability.amount || 0);
      target.bonus = target.revive;
      target.revealed = false;
      target.hold = true;
      back.hand.push(target);
      pushFeed(state, target.name + " torna dal buio nella mano " + (target.owner === "you" ? "del Custode" : "dell'Ombra") + ", più forte di prima.");
    }
    return true;
  }

  function sidePower(state, side, locIndex) {
    var loc = state.locations[locIndex];
    var sum = 0;
    var board = state[side].board[locIndex];
    for (var i = 0; i < board.length; i++) {
      if (!board[i].revealed) continue;
      sum += cardPower(state, board[i], locIndex);
    }
    var mine = board.length;
    var theirs = state[other(side)].board[locIndex].length;
    if (loc.moreCards && mine > theirs) sum += loc.moreCards;
    if (loc.fewerCards && mine < theirs) sum += loc.fewerCards;
    if (loc.double) sum *= 2;
    return sum;
  }

  function isBehind(state, side, locIndex) {
    return sidePower(state, other(side), locIndex) > sidePower(state, side, locIndex);
  }

  function countOthers(state, locIndex, uid) {
    var n = 0;
    var all = state.you.board[locIndex].concat(state.rival.board[locIndex]);
    for (var i = 0; i < all.length; i++) if (all[i].uid !== uid) n++;
    return n;
  }

  function pickFrom(cards, locIndex, state, mode) {
    var list = [];
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].revealed && !isFixed(state, cards[i], locIndex)) list.push(cards[i]);
    }
    if (!list.length) return null;
    list.sort(function (a, b) {
      var pa = cardPower(state, a, locIndex);
      var pb = cardPower(state, b, locIndex);
      if (pa !== pb) return mode === "high" ? pb - pa : pa - pb;
      return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
    });
    return list[0];
  }

  function openDestinations(state, side, from) {
    var open = [];
    for (var i = 0; i < state.locations.length; i++) {
      if (i === from) continue;
      var max = state.locations[i].maxCards || LANE_MAX;
      if (state[side].board[i].length >= max) continue;
      open.push(i);
    }
    return open;
  }

  function moveCard(state, card, from, to) {
    if (to < 0 || isFixed(state, card, from)) return false;
    var src = state[card.owner].board[from];
    var idx = src.findIndex(function (c) { return c.uid === card.uid; });
    if (idx < 0) return false;
    var dest = state[card.owner].board[to];
    var max = state.locations[to].maxCards || LANE_MAX;
    if (dest.length >= max) return false;
    src.splice(idx, 1);
    dest.push(card);
    return true;
  }

  function chooseDest(state, side, from, prefer) {
    var open = openDestinations(state, side, from);
    if (!open.length) return -1;
    open.sort(function (a, b) {
      if (prefer === "hurt") {
        return sidePower(state, side, a) - sidePower(state, side, b) || a - b;
      }
      var ba = sidePower(state, other(side), a) - sidePower(state, side, a);
      var bb = sidePower(state, other(side), b) - sidePower(state, side, b);
      return bb - ba || a - b;
    });
    return open[0];
  }

  function revealCard(state, card, locIndex) {
    if (!card || card.revealed) return;
    var behind = isBehind(state, card.owner, locIndex);
    var others = countOthers(state, locIndex, card.uid);
    card.revealed = true;
    var loc = state.locations[locIndex];
    pushFeed(state, (card.owner === "you" ? "Riveli " : "L'Ombra rivela ") + card.name + " · " + loc.name + ".");
    if (loc.firstBonus && !loc.first[card.owner]) {
      loc.first[card.owner] = card.uid;
      card.bonus += loc.firstBonus;
      pushFeed(state, loc.name + ": il primo colpo tempra, +" + loc.firstBonus + ".");
    }
    applyAbility(state, card, locIndex, behind, others);
    keepPromises(state, card, locIndex);
    state.revealLog.push(card.uid);
    state.fresh.push(card.uid);
  }

  function applyAbility(state, card, locIndex, behind, others) {
    var ab = card.ability;
    if (!ab) return;
    var owner = state[card.owner];
    if (ab.op === "energy") {
      if (state.turn >= 6) {
        pushFeed(state, card.name + ": non resta un'ora a cui donarlo.");
        return;
      }
      owner.nextEnergy += ab.amount;
      pushFeed(state, card.name + ": +" + ab.amount + (ab.amount === 1 ? " lume" : " lumi") + " accesi per l'ora che viene.");
      return;
    }
    if (ab.op === "draw") {
      var drew = drawN(owner, ab.amount || 1, true);
      if (!drew) pushFeed(state, card.name + " cerca nel mazzo, ma è vuoto.");
      else pushFeed(state, card.name + (drew === 1 ? " ti porta una carta." : " ti porta " + drew + " carte."));
      return;
    }
    if (ab.op === "buff") {
      applyBuff(state, card, locIndex, behind, others);
      return;
    }
    if (ab.op === "move") {
      applyMove(state, card, locIndex);
      return;
    }
    if (ab.op === "summon") {
      // Covata: carte nuove in mano, giocabili dall'ora dopo.
      var names = [];
      (ab.ids || []).forEach(function (id) {
        if (!BY_CARD[id] || owner.hand.length >= HAND_MAX) return;
        var pup = instantiate(state, BY_CARD[id], card.owner);
        pup.hold = true;
        owner.hand.push(pup);
        names.push(pup.name);
      });
      pushFeed(state, names.length ? card.name + " chiama a sé: " + names.join(", ") + "." : card.name + ": le tue mani sono già piene.");
      return;
    }
    if (ab.op === "seal") {
      state.locations[locIndex].sealed = true;
      pushFeed(state, card.name + " sigilla " + state.locations[locIndex].name + ": nessuno potrà più giocarci.");
      return;
    }
    if (ab.op === "bounce") {
      var mine = owner.board[locIndex].filter(function (c) { return c.uid !== card.uid && c.revealed; });
      mine.sort(function (a, b) { return cardPower(state, a, locIndex) - cardPower(state, b, locIndex) || (a.uid < b.uid ? -1 : 1); });
      var back = mine[0];
      if (!back || owner.hand.length >= HAND_MAX) { pushFeed(state, card.name + " non trova nessuno da riportare indietro."); return; }
      owner.board[locIndex].splice(owner.board[locIndex].indexOf(back), 1);
      back.revealed = false;
      back.bonus = 0;
      back.hold = true;
      owner.hand.push(back);
      pushFeed(state, card.name + " riporta " + back.name + " nella tua mano.");
      return;
    }
    if (ab.op === "draw-best") {
      if (!owner.deck.length || owner.hand.length >= HAND_MAX) { pushFeed(state, card.name + " cerca nel mazzo, ma non trova nulla."); return; }
      var best = 0;
      for (var d = 1; d < owner.deck.length; d++) {
        if (owner.deck[d].cost >= owner.deck[best].cost) best = d;
      }
      var star = owner.deck.splice(best, 1)[0];
      star.hold = true;
      owner.hand.push(star);
      pushFeed(state, card.name + " indica la stella più lontana: ti porta " + (card.owner === "you" ? star.name : "una carta") + ".");
      return;
    }
    if (ab.op === "destroy") {
      applyDestroy(state, card, locIndex);
      return;
    }
    var foe = other(card.owner);
    if (ab.op === "pull") {
      // Cacciadraghi: tira qui la carta nemica più debole da un'altra rovina.
      var max = state.locations[locIndex].maxCards || LANE_MAX;
      if (state[foe].board[locIndex].length >= max) { pushFeed(state, card.name + ": qui non c'è più posto per nessuno."); return; }
      var prey = null, from = -1, preyPower = 0;
      for (var li = 0; li < state.locations.length; li++) {
        if (li === locIndex) continue;
        var lane = state[foe].board[li];
        for (var ci = 0; ci < lane.length; ci++) {
          var c = lane[ci];
          if (!c.revealed || isFixed(state, c, li)) continue;
          var pw = cardPower(state, c, li);
          if (!prey || pw < preyPower || (pw === preyPower && c.uid < prey.uid)) { prey = c; from = li; preyPower = pw; }
        }
      }
      if (!prey || !moveCard(state, prey, from, locIndex)) { pushFeed(state, card.name + " lancia l'arpione, ma non aggancia nessuno."); return; }
      pushFeed(state, card.name + " aggancia " + prey.name + " e lo trascina fino a " + state.locations[locIndex].name + ".");
      return;
    }
    if (ab.op === "copy-enemy") {
      // Assassino: prende il nome (una copia) della carta nemica più forte qui.
      var marks = state[foe].board[locIndex].filter(function (c) { return c.revealed; });
      marks.sort(function (a, b) { return cardPower(state, b, locIndex) - cardPower(state, a, locIndex) || (a.uid < b.uid ? -1 : 1); });
      var mark = marks[0];
      if (!mark || !BY_CARD[mark.id] || owner.hand.length >= HAND_MAX) { pushFeed(state, card.name + " non trova nessun nome da rubare."); return; }
      var twin = instantiate(state, BY_CARD[mark.id], card.owner);
      twin.hold = true;
      owner.hand.push(twin);
      pushFeed(state, card.name + " ruba il nome di " + mark.name + ": una copia " + (card.owner === "you" ? "è nella tua mano." : "passa all'Ombra."));
      return;
    }
    if (ab.op === "steal-energy") {
      if (state.turn >= 6) { pushFeed(state, card.name + ": non resta un'ora a cui rubare."); return; }
      state[foe].nextEnergy = (state[foe].nextEnergy || 0) - ab.amount;
      owner.nextEnergy = (owner.nextEnergy || 0) + ab.amount;
      pushFeed(state, card.name + " ruba un lume: all'ora che viene " + (card.owner === "you" ? "l'Ombra ne avrà uno in meno, tu uno in più." : "tu ne avrai uno in meno, l'Ombra uno in più."));
      return;
    }
    if (ab.op === "promise") {
      if (state.turn >= 6) { pushFeed(state, card.name + " suona il corno, ma non verrà più nessuno."); return; }
      card.promise = { turn: state.turn + 1, amount: ab.amount };
      pushFeed(state, card.name + " suona il corno: se all'ora dopo arriva qualcuno qui, +" + ab.amount + ".");
      return;
    }
    if (ab.op === "discount") {
      var dear = null;
      owner.hand.forEach(function (c) {
        if (!dear || (c.cost - (c.cut || 0)) > (dear.cost - (dear.cut || 0))) dear = c;
      });
      if (!dear) { pushFeed(state, card.name + ": non c'è nessuna porta da aprire."); return; }
      dear.cut = (dear.cut || 0) + ab.amount;
      pushFeed(state, card.name + " apre la via: " + (card.owner === "you" ? dear.name : "una carta dell'Ombra") + " costa " + ab.amount + " in meno.");
      return;
    }
    if (ab.op === "hand") {
      var target = ab.side === "enemy" ? state[foe].hand : owner.hand;
      target.forEach(function (c) { c.bonus = (c.bonus || 0) + ab.amount; });
      var whose = (ab.side === "enemy") === (card.owner === "you") ? "nella mano dell'Ombra" : "nella tua mano";
      pushFeed(state, target.length ? card.name + ": le carte " + whose + " " + (ab.amount > 0 ? "+" : "−") + Math.abs(ab.amount) + "." : card.name + ": non c'è nessuna carta da toccare.");
    }
  }

  // L'Araldo e simili: se all'ora promessa il loro padrone scopre un'altra carta lì, il bonus arriva.
  function keepPromises(state, card, locIndex) {
    var mine = state[card.owner].board[locIndex];
    for (var i = 0; i < mine.length; i++) {
      var c = mine[i];
      if (c.uid === card.uid || !c.promise || c.promise.turn !== state.turn) continue;
      c.bonus += c.promise.amount;
      pushFeed(state, c.name + ": la promessa è mantenuta, +" + c.promise.amount + ".");
      c.promise = null;
    }
  }

  // Alla fine di ogni ora: il Pirata cresce, la Piaga consuma i nemici. (Nella Cripta tacciono.)
  function endOfHour(state) {
    for (var li = 0; li < state.locations.length; li++) {
      if (state.locations[li].suppressOngoing) continue;
      ["you", "rival"].forEach(function (side) {
        state[side].board[li].forEach(function (c) {
          if (!c.revealed || !c.ability) return;
          if (c.ability.op === "grow") c.bonus += c.ability.amount;
          if (c.ability.op === "poison") {
            var hit = 0;
            state[other(side)].board[li].forEach(function (e) { if (e.revealed) { e.bonus -= c.ability.amount; hit++; } });
            if (hit) pushFeed(state, c.name + " consuma " + (hit === 1 ? "un nemico" : hit + " nemici") + " a " + state.locations[li].name + ": −" + c.ability.amount + ".");
          }
        });
      });
    }
  }

  function applyDestroy(state, card, locIndex) {
    var ab = card.ability;
    var power = function (c) { return cardPower(state, c, locIndex); };
    var enemies = state[other(card.owner)].board[locIndex].filter(function (c) { return c.revealed; });
    var sortBy = function (list, high) {
      return list.slice().sort(function (a, b) { return (high ? power(b) - power(a) : power(a) - power(b)) || (a.uid < b.uid ? -1 : 1); });
    };
    if (ab.target === "enemy-weak") {
      var weak = sortBy(enemies, false)[0];
      if (weak) destroyCard(state, weak, locIndex, card);
      else pushFeed(state, card.name + " non trova nessuno da seppellire.");
      return;
    }
    if (ab.target === "enemy-strong") {
      var strong = sortBy(enemies, true)[0];
      if (strong && power(strong) <= (ab.max != null ? ab.max : 99)) destroyCard(state, strong, locIndex, card);
      else pushFeed(state, card.name + " cala la spada, ma il nemico è troppo forte.");
      return;
    }
    if (ab.target === "all-weak") {
      var all = state.you.board[locIndex].concat(state.rival.board[locIndex]).filter(function (c) {
        return c.uid !== card.uid && c.revealed && power(c) <= (ab.max != null ? ab.max : 1);
      });
      if (!all.length) { pushFeed(state, card.name + " grida, ma qui nessuno è abbastanza debole."); return; }
      all.forEach(function (c) { destroyCard(state, c, locIndex, card); });
    }
  }

  function applyBuff(state, card, locIndex, behind, others) {
    var ab = card.ability;
    var allies = state[card.owner].board[locIndex].filter(function (c) {
      return c.uid !== card.uid && c.revealed;
    });
    var enemies = state[other(card.owner)].board[locIndex].filter(function (c) { return c.revealed; });
    if (ab.target === "self-per-card") {
      card.bonus += others * ab.amount;
      if (others) pushFeed(state, card.name + " conta " + others + " presenze: +" + (others * ab.amount) + ".");
      return;
    }
    if (ab.target === "self-if-turn") {
      if (state.turn >= ab.turn) {
        card.bonus += ab.amount;
        pushFeed(state, card.name + " sente rintoccare l'ora: +" + ab.amount + ".");
      }
      return;
    }
    if (ab.target === "self-if-behind") {
      if (behind) {
        card.bonus += ab.amount;
        pushFeed(state, card.name + " sente la rovina cedere: +" + ab.amount + ".");
      }
      return;
    }
    if (ab.target === "self-if-more-cards") {
      if (state[card.owner].board[locIndex].length > state[other(card.owner)].board[locIndex].length) {
        card.bonus += ab.amount;
        pushFeed(state, card.name + " conta i compagni: +" + ab.amount + ".");
      }
      return;
    }
    if (ab.target === "self-if-stake") {
      if (state.stake > 1) {
        card.bonus += ab.amount;
        pushFeed(state, card.name + " pesa quanto il pegno: +" + ab.amount + ".");
      }
      return;
    }
    if (ab.target === "copy-strong") {
      var model = enemies.slice().sort(function (a, b) { return cardPower(state, b, locIndex) - cardPower(state, a, locIndex) || (a.uid < b.uid ? -1 : 1); })[0];
      if (!model) return;
      var gap = cardPower(state, model, locIndex) - cardPower(state, card, locIndex);
      if (gap > 0) {
        card.bonus += gap;
        pushFeed(state, card.name + " riflette " + model.name + ": +" + gap + ".");
      }
      return;
    }
    if (ab.target === "ally-adjacent-all") {
      var lifted = 0;
      [locIndex - 1, locIndex + 1].forEach(function (j) {
        var lane = state[card.owner].board[j];
        if (!lane) return;
        lane.forEach(function (c) { if (c.revealed) { c.bonus += ab.amount; lifted++; } });
      });
      if (lifted) pushFeed(state, card.name + " chiama a raccolta le rovine accanto: +" + ab.amount + " a " + lifted + (lifted === 1 ? " carta." : " carte."));
      return;
    }
    if (ab.target === "self-if-alone") {
      if (state[card.owner].board[locIndex].length === 1) {
        card.bonus += ab.amount;
        pushFeed(state, card.name + ", sola contro tutti: +" + ab.amount + ".");
      }
      return;
    }
    if (ab.target === "ally-weak" || ab.target === "ally-strong") {
      var pick = pickFrom(allies, locIndex, state, ab.target === "ally-weak" ? "low" : "high");
      if (!pick) return;
      pick.bonus += ab.amount;
      pushFeed(state, card.name + " infonde +" + ab.amount + " in " + pick.name + ".");
      return;
    }
    if (ab.target === "ally-all") {
      if (!allies.length) return;
      allies.forEach(function (c) { c.bonus += ab.amount; });
      pushFeed(state, card.name + " infonde +" + ab.amount + " in ogni alleato qui.");
      return;
    }
    if (ab.target === "enemy-strong") {
      var strong = pickFrom(enemies, locIndex, state, "high");
      if (!strong) return;
      strong.bonus += ab.amount;
      pushFeed(state, card.name + " strappa " + Math.abs(ab.amount) + " di forza a " + strong.name + ".");
      return;
    }
    if (ab.target === "enemy-all") {
      if (!enemies.length) return;
      enemies.forEach(function (c) { c.bonus += ab.amount; });
      pushFeed(state, card.name + " maledice ogni nemico qui: −" + Math.abs(ab.amount) + ".");
    }
  }

  function applyMove(state, card, locIndex) {
    var ab = card.ability;
    var side = ab.target === "ally" ? card.owner : other(card.owner);
    var pool = state[side].board[locIndex].filter(function (c) { return c.uid !== card.uid; });
    var target = pickFrom(pool, locIndex, state, ab.pick === "low" ? "low" : "high");
    if (!target) {
      pushFeed(state, card.name + " non trova nessuno da trascinare via.");
      return;
    }
    var dest = chooseDest(state, side, locIndex, ab.target === "ally" ? "help" : "hurt");
    if (dest < 0 || !moveCard(state, target, locIndex, dest)) {
      pushFeed(state, card.name + " non trova pietre libere altrove.");
      return;
    }
    if (ab.amount) target.bonus += ab.amount;
    var extra = ab.amount ? " e le dà +" + ab.amount : "";
    pushFeed(state, card.name + " trascina " + target.name + " fino a " + state.locations[dest].name + extra + ".");
  }

  function placeStaged(state, side) {
    var player = state[side];
    player.staged.forEach(function (p) {
      var card = player.limbo[p.uid];
      delete player.limbo[p.uid];
      if (!card) return;
      card.revealed = false;
      player.board[p.location].push(card);
    });
  }

  function buildQueue(state) {
    var first = state.priority === "rival" ? "rival" : "you";
    var second = other(first);
    var queue = [];
    function add(side, last) {
      state[side].staged.forEach(function (p) {
        var loc = state.locations[p.location];
        if (!!loc.revealLast !== last) return;
        queue.push({ side: side, uid: p.uid, location: p.location });
      });
    }
    add(first, false);
    add(second, false);
    add(first, true);
    add(second, true);
    return queue;
  }

  function updatePriority(state) {
    var you = 0;
    var rival = 0;
    for (var i = 0; i < state.locations.length; i++) {
      var a = sidePower(state, "you", i);
      var b = sidePower(state, "rival", i);
      if (a > b) you++;
      else if (b > a) rival++;
    }
    if (you > rival) state.priority = "you";
    else if (rival > you) state.priority = "rival";
  }

  function winnerFromBoard(state) {
    var you = 0;
    var rival = 0;
    for (var i = 0; i < state.locations.length; i++) {
      var a = sidePower(state, "you", i);
      var b = sidePower(state, "rival", i);
      if (a > b) you++;
      else if (b > a) rival++;
    }
    if (you > rival) return "you";
    if (rival > you) return "rival";
    return "tie";
  }

  function conclude(state, winner, reason) {
    state.phase = "over";
    state.winner = winner;
    state.reason = reason;
    state.queue = [];
    if (reason === "ritiro") {
      pushFeed(state, state.retreated === "you" ? "Il Custode abbandona la veglia." : "L'Ombra si dissolve prima della campana.");
    } else if (winner === "you") pushFeed(state, "Suona la sesta campana. Il Custode tiene più rovine.");
    else if (winner === "rival") pushFeed(state, "Suona la sesta campana. L'Ombra tiene più rovine.");
    else pushFeed(state, "Suona la sesta campana. Le rovine restano divise.");
  }

  function finishRevealPhase(state) {
    endOfHour(state);
    updatePriority(state);
    if (state.turn >= 6) {
      conclude(state, winnerFromBoard(state), "banchi");
      return;
    }
    beginTurn(state);
  }

  function endTurn(state) {
    if (!state || state.phase !== "plan") return fail("fase");
    state.fresh = [];
    state.queue = buildQueue(state);
    placeStaged(state, "you");
    placeStaged(state, "rival");
    state.you.staged = [];
    state.rival.staged = [];
    if (!state.queue.length) {
      finishRevealPhase(state);
      return { ok: true, done: true };
    }
    state.phase = "reveal";
    pushFeed(state, "Le carte si voltano.");
    return { ok: true, done: false };
  }

  function step(state) {
    if (!state || state.phase !== "reveal") return { ok: false, done: true };
    var item = state.queue.shift();
    if (!item) {
      finishRevealPhase(state);
      return { ok: true, done: true };
    }
    var found = findCard(state, item.uid);
    if (found && !found.card.revealed) revealCard(state, found.card, found.location);
    if (!state.queue.length && state.phase === "reveal") {
      finishRevealPhase(state);
      return { ok: true, done: true };
    }
    return { ok: true, done: state.phase !== "reveal" };
  }

  function resolve(state) {
    var started = endTurn(state);
    var guard = 0;
    while (state.phase === "reveal" && guard++ < 40) step(state);
    return started;
  }

  function retreat(state, side) {
    side = side || "you";
    if (!state || state.phase !== "plan") return fail("fase");
    state.retreated = side;
    conclude(state, side === "you" ? "rival" : "you", "ritiro");
    return { ok: true, winner: state.winner };
  }

  function snap(state, side) {
    side = side || "you";
    if (!state || state.phase !== "plan") return fail("fase");
    if (side === "you" && state.youSnapped) return fail("gia");
    if (side === "rival" && state.rivalSnapped) return fail("gia");
    if (side === "you") state.youSnapped = true;
    else state.rivalSnapped = true;
    state.stake = Math.min(8, state.stake * 2);
    pushFeed(state, (side === "you" ? "Alzi il pegno" : "L'Ombra alza il pegno") + ". Ora vale " + state.stake + ".");
    if (side === "you" && rivalFolds(state)) return { ok: true, stake: state.stake, folded: true };
    return { ok: true, stake: state.stake };
  }

  function position(state, side) {
    var wins = 0;
    var losses = 0;
    var diff = 0;
    for (var i = 0; i < state.locations.length; i++) {
      var mine = sidePower(state, side, i);
      var theirs = sidePower(state, other(side), i);
      diff += mine - theirs;
      if (mine > theirs) wins++;
      else if (theirs > mine) losses++;
    }
    return { wins: wins, losses: losses, diff: diff };
  }

  function evaluate(state, side) {
    var pos = position(state, side);
    return pos.wins * 10000 - pos.losses * 7000 + pos.diff;
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function predictPlay(state, side, uid, locIndex) {
    var player = state[side];
    var idx = player.hand.findIndex(function (c) { return c.uid === uid; });
    if (idx < 0) return;
    var card = player.hand[idx];
    player.hand.splice(idx, 1);
    player.energyLeft -= playCost(state, card, locIndex);
    player.board[locIndex].push(card);
    revealCard(state, card, locIndex);
  }

  function predictStaged(state, side) {
    var plays = state[side].staged.slice();
    for (var i = 0; i < plays.length; i++) {
      var card = state[side].limbo[plays[i].uid];
      if (!card) continue;
      delete state[side].limbo[plays[i].uid];
      state[side].board[plays[i].location].push(card);
      revealCard(state, card, plays[i].location);
    }
    state[side].staged = [];
    return state;
  }

  function playKey(plays) {
    return plays.map(function (p) { return p.uid + "@" + p.location; }).join("|");
  }

  function planRival(state) {
    if (!state.ai || state.phase !== "plan") return;
    var cfg = state.aiCfg || AI_LEVELS[4];
    var luck = mulberry32((state.seed ^ (state.turn * 7919)) >>> 0);
    if (cfg.slip && luck() < cfg.slip) {
      // Un'Ombra giovane sbaglia: posa a caso quello che può.
      var hand0 = shuffle(state.rival.hand.slice(), luck);
      for (var h = 0; h < hand0.length; h++) {
        var lanes0 = shuffle(lanesOf(state), luck);
        for (var l = 0; l < lanes0.length; l++) {
          if (canPlay(state, "rival", hand0[h].uid, lanes0[l])) { stage(state, "rival", hand0[h].uid, lanes0[l]); break; }
        }
      }
      return;
    }
    var root = cloneState(state);
    var beam = [{ plays: [], state: root, score: evaluate(root, "rival") }];
    for (var depth = 0; depth < cfg.depth; depth++) {
      var next = [];
      for (var n = 0; n < beam.length; n++) {
        var node = beam[n];
        next.push(node);
        var hand = node.state.rival.hand;
        for (var ci = 0; ci < hand.length; ci++) {
          for (var loc = 0; loc < node.state.locations.length; loc++) {
            if (!canPlay(node.state, "rival", hand[ci].uid, loc)) continue;
            var trial = cloneState(node.state);
            predictPlay(trial, "rival", hand[ci].uid, loc);
            var plays = node.plays.concat([{ uid: hand[ci].uid, location: loc }]);
            next.push({ plays: plays, state: trial, score: evaluate(trial, "rival") });
          }
        }
      }
      next.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        var ka = playKey(a.plays);
        var kb = playKey(b.plays);
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });
      beam = next.slice(0, cfg.beam);
    }
    var best = beam[0];
    if (!best || !best.plays.length) return;
    if (best.score < evaluate(state, "rival")) return;
    for (var p = 0; p < best.plays.length; p++) {
      stage(state, "rival", best.plays[p].uid, best.plays[p].location);
    }
  }

  function rivalFolds(state) {
    if (!state.ai || state.phase !== "plan") return false;
    if (state.turn < 4 || state.stake < 2) return false;
    var sim = predictStaged(cloneState(state), "rival");
    var pos = position(sim, "rival");
    var margin = state.turn >= 5 ? -6 : -10;
    if (pos.wins === 0 && pos.diff <= margin) {
      retreat(state, "rival");
      return true;
    }
    return false;
  }

  function afterPlan(state) {
    if (!state.ai || state.phase !== "plan") return;
    if (rivalFolds(state)) return;
    if (state.aiCfg && !state.aiCfg.snaps) return;
    if (state.rivalSnapped || state.turn < 4 || state.stake >= 8) return;
    var sim = predictStaged(cloneState(state), "rival");
    var pos = position(sim, "rival");
    if (pos.wins > state.locations.length / 2 && pos.diff >= 6) {
      state.rivalSnapped = true;
      state.stake = Math.min(8, state.stake * 2);
      pushFeed(state, "L'Ombra alza il pegno. Ora vale " + state.stake + ".");
    }
  }

  function headline(state) {
    if (state.phase !== "over") return "La notte non è ancora finita.";
    if (state.reason === "ritiro" && state.retreated === "you") return "Hai abbandonato la veglia.";
    if (state.reason === "ritiro") return "L'Ombra si dissolve.";
    if (state.winner === "you") return "Il Sigillo regge.";
    if (state.winner === "rival") return "Il Sigillo si incrina.";
    return "Il Sigillo trema, ma non cede.";
  }

  function publicCard(state, card, locIndex, hide) {
    if (hide && !card.revealed) return { hidden: true, fresh: state.fresh.indexOf(card.uid) >= 0 };
    return {
      uid: card.uid,
      id: card.id,
      house: card.house || "",
      name: card.name,
      cost: Math.max(Math.min(1, card.cost), card.cost - (card.cut || 0)),
      baseCost: card.cost,
      power: card.power,
      current: card.revealed ? cardPower(state, card, locIndex) : card.power + (card.bonus || 0),
      text: card.text,
      lore: card.lore || "",
      kind: card.kind,
      anchor: !!card.anchor,
      revealed: !!card.revealed,
      owner: card.owner,
      fresh: state.fresh.indexOf(card.uid) >= 0
    };
  }

  function view(state) {
    var scoreYou = lanesOf(state).map(function (i) { return sidePower(state, "you", i); });
    var scoreRival = lanesOf(state).map(function (i) { return sidePower(state, "rival", i); });
    var youLanes = 0;
    var rivalLanes = 0;
    var lanes = state.locations.map(function (loc, i) {
      var lead = "tie";
      if (scoreYou[i] > scoreRival[i]) { lead = "you"; youLanes++; }
      else if (scoreRival[i] > scoreYou[i]) { lead = "rival"; rivalLanes++; }
      var incoming = state.you.staged.filter(function (s) { return s.location === i; }).map(function (s, order) {
        var card = publicCard(state, state.you.limbo[s.uid], i, false);
        card.incoming = true;
        card.order = order + 1;
        card.paid = s.paid;
        return card;
      });
      return {
        id: loc.id,
        name: loc.name,
        text: loc.text,
        lore: loc.lore || "",
        you: scoreYou[i],
        rival: scoreRival[i],
        lead: lead,
        closed: isClosed(state, loc),
        sealed: !!loc.sealed,
        max: loc.maxCards || LANE_MAX,
        yours: state.you.board[i].map(function (c) { return publicCard(state, c, i, false); }),
        rivals: state.rival.board[i].map(function (c) { return publicCard(state, c, i, true); }),
        incoming: incoming
      };
    });
    return {
      seed: state.seed,
      daily: state.daily,
      date: state.date,
      house: state.house,
      rivalHouse: state.rivalHouse,
      turn: state.turn,
      phase: state.phase,
      priority: state.priority,
      priorityText: state.priority === "you" ? "Riveli prima dell'Ombra" : "L'Ombra rivela per prima",
      stake: state.stake,
      energy: state.you.energyLeft,
      maxEnergy: state.maxEnergy,
      nextEnergy: state.you.nextEnergy,
      youSnapped: state.youSnapped,
      rivalSnapped: state.rivalSnapped,
      winner: state.winner,
      reason: state.reason,
      retreated: state.retreated,
      headline: headline(state),
      line: state.line,
      feed: state.feed.slice(-8),
      hand: state.you.hand.map(function (c) { return publicCard(state, c, 0, false); }),
      rivalHand: state.rival.hand.length,
      deck: state.you.deck.length,
      rivalDeck: state.rival.deck.length,
      lanes: lanes,
      youLanes: youLanes,
      rivalLanes: rivalLanes,
      canSnap: state.phase === "plan" && !state.youSnapped && !state.winner,
      canRetreat: state.phase === "plan" && !state.winner,
      canEnd: state.phase === "plan" && !state.winner,
      revealing: state.phase === "reveal"
    };
  }

  function shareText(state) {
    var when = state.date ? state.date + " — " : "";
    var marks = state.locations.map(function (loc, i) {
      var a = sidePower(state, "you", i);
      var b = sidePower(state, "rival", i);
      return a > b ? "◆" : b > a ? "◇" : "·";
    }).join("");
    return "SIGIL " + when + headline(state) + " " + marks + " Pegno " + state.stake + ". Seme " + state.seed + ".";
  }

  /* ───────── PvP: le giocate viaggiano come [{uid, location}] ───────── */
  function myPlays(state) {
    return state.you.staged.map(function (s) { return { uid: s.uid, location: s.location }; });
  }

  function submitRival(state, plays) {
    if (!state || state.phase !== "plan") return fail("fase");
    var list = Array.isArray(plays) ? plays : [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p || typeof p.uid !== "string" || typeof p.location !== "number") return fail("mano");
      var res = stage(state, "rival", p.uid, p.location);
      if (!res.ok) return res;
    }
    return { ok: true, count: list.length };
  }

  function put(state, side, loc, id, extra) {
    if (!BY_CARD[id]) throw new Error("Carta sconosciuta: " + id);
    var card = instantiate(state, BY_CARD[id], side);
    if (extra) Object.assign(card, extra);
    if (!extra || extra.revealed !== false) card.revealed = true;
    state[side].board[loc].push(card);
    return card;
  }

  function revealAt(state, side, loc, id) {
    if (!BY_CARD[id]) throw new Error("Carta sconosciuta: " + id);
    var card = instantiate(state, BY_CARD[id], side);
    state[side].board[loc].push(card);
    revealCard(state, card, loc);
    return card;
  }

  return {
    CARDS: CARDS,
    HOUSES: HOUSES,
    EXPANSION: EXPANSION,
    ALL_CARDS: ALL_CARDS,
    AI_LEVELS: AI_LEVELS,
    DECK_SIZE: DECK_SIZE,
    deckList: deckList,
    myPlays: myPlays,
    submitRival: submitRival,
    LOCATIONS: LOCATIONS,
    REASONS: REASONS,
    createMatch: createMatch,
    play: play,
    stage: stage,
    unstage: unstage,
    undo: undo,
    endTurn: endTurn,
    step: step,
    resolve: resolve,
    retreat: retreat,
    snap: snap,
    legal: legal,
    quote: quote,
    view: view,
    shareText: shareText,
    dailySeed: dailySeed,
    todayKey: todayKey,
    sidePower: sidePower,
    cardPower: cardPower,
    test: {
      put: put,
      revealAt: revealAt,
      sidePower: sidePower,
      cardPower: cardPower,
      position: position,
      endOfHour: endOfHour,
      destroyCard: destroyCard,
      playCost: playCost
    }
  };
});
