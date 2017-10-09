(function(){
"use strict";


// Maps currency codes (eg. "EUR") to an object containing a currencies' name
// (eg. "Euro") and symbol (eg. "€"). See https://tinyurl.com/jsmapdocs
// for more info on maps.
const currencies = new Map([
  [ "AUD", { name: "Australian dollar", symbol: "A$" } ],
  [ "BGN", { name: "Bulgarian lev", symbol: "лв" } ],
  [ "BRL", { name: "Brazilian real", symbol: "R$" } ],
  [ "CAD", { name: "Canadian dollar", symbol: "C$" } ],
  [ "CHF", { name: "Swiss franc", symbol: "Fr" } ],
  [ "CNY", { name: "Chinese yuan", symbol: "元" } ],
  [ "CZK", { name: "Czech koruna", symbol: "Kč" } ],
  [ "DKK", { name: "Danish krone", symbol: "kr." } ],
  [ "EUR", { name: "Euro", symbol: "€" } ],
  [ "GBP", { name: "Pound sterling", symbol: "£" } ],
  [ "HKD", { name: "Hong Kong dollar", symbol: "HK$" } ],
  [ "HRK", { name: "Croatian kuna", symbol: "kn" } ],
  [ "HUF", { name: "Hungarian forint", symbol: "Ft" } ],
  [ "IDR", { name: "Indonesian rupiah", symbol: "Rp" } ],
  [ "ILS", { name: "Israeli new shekel", symbol: "₪" } ],
  [ "INR", { name: "Indian rupee", symbol: "₹" } ],
  [ "JPY", { name: "Japanese yen", symbol: "¥" } ],
  [ "KRW", { name: "South Korean won", symbol: "₩" } ],
  [ "MXN", { name: "Mexican peso", symbol: "Mex$" } ],
  [ "MYR", { name: "Malaysian ringgit", symbol: "RM" } ],
  [ "NOK", { name: "Norwegian krone", symbol: "kr" } ],
  [ "NZD", { name: "New Zealand dollar", symbol: "$" } ],
  [ "PHP", { name: "Philippine peso", symbol: "₱" } ],
  [ "PLN", { name: "Polish złoty", symbol: "zł" } ],
  [ "RON", { name: "Romanian leu", symbol: "L" } ],
  [ "RUB", { name: "Russian ruble", symbol: "₽" } ],
  [ "SEK", { name: "Swedish krona", symbol: "kr" } ],
  [ "SGD", { name: "Singapore dollar", symbol: "S$" } ],
  [ "THB", { name: "Thai baht", symbol: "฿" } ],
  [ "TRY", { name: "Turkish lira", symbol: "₺" } ],
  [ "USD", { name: "United States dollar", symbol: "$" } ],
  [ "ZAR", { name: "South African rand", symbol: "R" } ],
]);


// The currency data comes from the European Central Bank and only contains
// exchange rates relative to the euro. Use this function to get the rate from
// one any currency to any another
function convertRelative (rates, from, to, base = "EUR") {
  if (to === base && from === base) {
    return 1;
  } else {
    if (to === base) {
      return 1 / rates[from];
    } else if (from === base) {
      return rates[to];
    } else {
      return rates[to] / rates[from];
    }
  }
}


// Get the first element matching "selector"
function $ (selector, context = window.document) {
  return context.querySelector(selector);
}


// An array of elements matching "selector"
function $$ (selector, context = window.document) {
  return Array.from(context.querySelectorAll(selector));
}


// Create a new element, eg. createElement("a", { href: "/", innerHTML: "foo" })
function createElement(tag, properties) {
  const element = window.document.createElement(tag);
  Object.assign(element, properties);
  return element;
}


// Add one ore more event handlers to one ore more events (string separated by
// whitespace) to one or more elements, eg. on(myDiv, "click keydown", doStuff)
// or on([ myInput, mySelect ], "change", doStuff, doOtherStuff)
function on (elements, events, ...handlers) {
  if (!Array.isArray(elements)) {
    return on([ elements ], events, ...handlers);
  }
  events = events.split(/\s+/);
  for (const element of elements) {
    for (const event of events) {
      for (const handler of handlers) {
        element.addEventListener(event, handler);
      }
    }
  }
}


// Create option elements for the select elements from the currencies
function createOptionElements (currencies) {
  return Array.from(currencies)
    .map( ([ code, { name } ]) => createElement("option", {
      innerHTML: `${name} (${code})`,
      value: code,
    }) );
}


// DOM elements
const travelCurrencyInput  = $(".currency__select--travel");
const homeCurrencyInput    = $(".currency__select--home");
const travelAmountInput    = $(".amount__input--travel");
const travelCurrencyOutput = $(".amount__currency--travel");
const homeAmountOutput     = $(".amount__output--home");
const homeCurrencyOutput   = $(".amount__currency--home");
const refreshButton        = $(".refresh");


// Populate select elements
travelCurrencyInput.append(...createOptionElements(currencies));
homeCurrencyInput.append(...createOptionElements(currencies));


// =======================================================
// Your code goes here! (and maybe into a service worker?)
// =======================================================


// Save and restore the last inputs from local storage

localforage.config({ name: "monie", storeName: "cache", });

async function saveInput (travelCurrency, homeCurrency, travelAmount) {
  const latestInput = { travelCurrency, homeCurrency, travelAmount };
  return localforage.setItem("input", latestInput);
}

async function restoreInput () {
  const lastInput = await localforage.getItem("input");
  if (!lastInput) {
    // Use default values if nothing has been stored so far
    return {
      travelCurrency: "GBP",
      homeCurrency: "EUR",
      travelAmount: 1,
    };
  }
  return lastInput;
}


// Fetch rates. If this is a refresh, add "?refresh=true" to the url
async function getRates (refreshing = false) {
  let url = "api/latest.json";
  if (refreshing) {
    url += "?refresh=true";
  }
  const response = await fetch(url);
  if (response.ok) {
    return response.json();
  } else {
    throw new Error(`Request failed with status code ${ response.staus }`)
  }
}


// Compute exchange rates from current inputs and rates passed to the function
function calculateRates (rates) {
  const travelCurrency = travelCurrencyInput.value;
  const homeCurrency = homeCurrencyInput.value;
  const rate = convertRelative(rates.rates, travelCurrency, homeCurrency);
  const travelAmount = Number(travelAmountInput.value);
  const homeAmount = rate * travelAmount;
  return { travelCurrency, homeCurrency, travelAmount, homeAmount };
}


// Apply new data to the dom
async function applyChanges (data) {
  const { travelCurrency, homeCurrency, travelAmount, homeAmount } = data;
  travelCurrencyOutput.innerHTML = travelCurrency;
  homeAmountOutput.innerHTML = homeAmount.toFixed(2);
  homeCurrencyOutput.innerHTML = homeCurrency;
  await saveInput(travelCurrency, homeCurrency, travelAmount);
  return data;
}


// Handle a click on the refresh link
async function handleRefreshClick () {
  if (!refreshButton.classList.contains("refresh--working")) {
    refreshButton.classList.add("refresh--working");
    try {
      return getRates(true);
    } finally {
      refreshButton.classList.remove("refresh--working");
    }
  }
}


function init (rates, lastInput) {
  // Set the inputs and selects to the last saved state
  travelCurrencyInput.value = lastInput.travelCurrency;
  homeCurrencyInput.value = lastInput.homeCurrency;
  travelAmountInput.value = lastInput.travelAmount;
  // Calculate and display the rates for the first time
  applyChanges(calculateRates(rates));
  // Setup event handlers for inputs and selects
  const elements = [ travelCurrencyInput, homeCurrencyInput, travelAmountInput ];
  on(elements, "keyup click change", () => applyChanges(calculateRates(rates)) );
  // Enable rate refresh
  on(refreshButton, "click", async (evt) => {
    const newRates = await handleRefreshClick();
    applyChanges(calculateRates(newRates));
  });
  // Display the app
  document.body.classList.add("loaded");
}


// Initialize with the rates and data from the cache
Promise.all([ getRates(), restoreInput() ])
  .then( ([ rates, lastInput ]) => init(rates, lastInput) )
  .catch( (reason) => window.alert(reason) );


// Launch the service worker and request permission for notifications once
// everything else is done
on(window, "load", () => {
  window.Notification.requestPermission();
  window.navigator.serviceWorker.register("worker.js").then( (registration) => {
    // Is there's no active service worker this is the first installation
    if (!registration.active) {
      if (window.Notification.permission === "granted") {
        new Notification("Ready for offline use", {
          icon: "img/icon192.png",
          badge: "img/icon192-mono.png",
          body: "You can use this web app at any time, even when you're offline",
        });
      }
    }
  });
});

})();
