(() => {
"use strict";


// Maps currency codes (eg. "EUR") to an object containing a currencies' name
// (eg. "Euro") and symbol (eg. "€"). See https://tinyurl.com/jsmapdocs
// for more information on maps.
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
const convertRelative = (rates, from, to, base = "EUR") => {
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
const $ = (selector, context = window.document) => {
  return context.querySelector(selector);
}


// An array of elements matching "selector"
const $$ = (selector, context = window.document) => {
  return Array.from(context.querySelectorAll(selector));
}


// Create a new element, eg. createElement("a", { href: "/", innerHTML: "foo" })
const createElement = (tag, properties) => {
  const element = window.document.createElement(tag);
  Object.assign(element, properties);
  return element;
}


// Add one ore more event handlers to one ore more events (string separated by
// whitespace) to one or more elements, eg. on(myDiv, "click keydown", doStuff)
// or on([ myInput, mySelect ], "change", doStuff, doOtherStuff)
const on = (elements, events, ...handlers) => {
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
const createOptionElements = (currencies) => {
  return Array.from(currencies)
    .map( ([ code, { name } ]) => createElement("option", {
      innerHTML: `${name} (${code})`,
      value: code,
    }) );
}


// DOM elements
const hamburgerButton      = $(".header__hamburger a");
const overlay              = $(".overlay");
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


// Handle sidebar and hamburger

let sidebarOpened = false;

const openSidebar = () => {
  document.body.classList.add("sidebarOpened");
  hamburgerButton.innerText = "✕";
  sidebarOpened = true;
}

const closeSidebar = () => {
  document.body.classList.remove("sidebarOpened");
  hamburgerButton.innerText = "≡";
  sidebarOpened = false;
}

on(hamburgerButton, "click", () => {
  (sidebarOpened) ? closeSidebar() : openSidebar();
});

on(overlay, "click", () => {
  (sidebarOpened) ? closeSidebar() : null;
});


// =======================================================
// Your code goes here! (and maybe into a service worker?)
// =======================================================


// Display the app when ready
// document.body.classList.add("loaded");


// Save and restore the last inputs from local storage

localforage.config({ name: "monie", storeName: "cache", });

const saveInput = async (travelCurrency, homeCurrency, travelAmount) => {
  const latestInput = { travelCurrency, homeCurrency, travelAmount };
  return localforage.setItem("input", latestInput);
}

const restoreInput = async () => {
  const lastInput = await localforage.getItem("input");
  if (!lastInput) {
    // Use default values if nothing has been stored so far
    return {
      travelCurrency: "GBP",
      homeCurrency: "EUR",
      travelAmount: 100,
    };
  }
  return lastInput;
}


// Fetch rates. If this is a refresh, add "?refresh=true" to the url
const getRates = async ({ refresh = false }) => {
  let url = "api/latest.json";
  if (refresh) {
    url += "?refresh=true";
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status code ${ response.staus }`)
  }
  return await response.json();
}


// Compute exchange rates from current inputs and rates passed to the function
const calculateRates = (rates) => {
  const travelCurrency = travelCurrencyInput.value;
  const homeCurrency = homeCurrencyInput.value;
  const rate = convertRelative(rates.rates, travelCurrency, homeCurrency);
  const travelAmount = Number(travelAmountInput.value);
  const homeAmount = rate * travelAmount;
  return { travelCurrency, homeCurrency, travelAmount, homeAmount };
}


// Apply new data to the dom
const applyChanges = async (data) => {
  const { travelCurrency, homeCurrency, travelAmount, homeAmount } = data;
  travelCurrencyOutput.innerHTML = travelCurrency;
  homeAmountOutput.innerHTML = homeAmount.toFixed(2);
  homeCurrencyOutput.innerHTML = homeCurrency;
  await saveInput(travelCurrency, homeCurrency, travelAmount);
  return data;
}


// Handle a click on the refresh link
const handleRefreshClick = async () => {
  window.Notification.requestPermission();
  if (!refreshButton.classList.contains("refresh--working")) {
    refreshButton.classList.add("refresh--working");
    try {
      return getRates({ refresh: true });
    } finally {
      refreshButton.classList.remove("refresh--working");
    }
  }
}


// Subscribe to messages from the service worker
if ("serviceWorker" in window.navigator) {
  window.navigator.serviceWorker.addEventListener("message", (evt) => {
    // Recieved a push notification that new rates are available
    if (evt.data.type === "NEW_RATES") {
      const newRates = evt.data.payload;
      applyChanges(calculateRates(newRates));
    }
  });
}


const init = (rates, lastInput) => {

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
Promise.all([ getRates({ refresh: false }), restoreInput() ])
  .then( ([ rates, lastInput ]) => init(rates, lastInput) )
  .catch( (reason) => window.alert(reason) );


// Subscribe to push notifications
const subscribeToPushNotifications = async (registration) => {
  try {
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true
      });
    }
    const { key, authSecret, endpoint } = getSubscriptionInfo(subscription);
    await postSubscripionInfo({ key, authSecret, endpoint });
    console.log("Registered to recieve push notifications");
  } catch (err) {
    console.log(`Failed to register for push notifications: ${err}`);
  }
};

const getSubscriptionInfo = (subscription) => {
  const rawKey = subscription.getKey("p256dh");
  const key = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
  const rawAuthSecret = subscription.getKey("auth");
  const authSecret = btoa(String.fromCharCode(...new Uint8Array(rawAuthSecret)));
  const endpoint = subscription.endpoint;
  return { key, authSecret, endpoint };
};

const postSubscripionInfo = async (data) => {
  const response = await fetch("/push-register", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "content-type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Post failed: ${ response.status }`);
  }
};


// Launch the service worker and subscribe to push notifications notifications once
// everything else is done
on(window, "load", async () => {
  if ("serviceWorker" in window.navigator) {

    const registration = await window.navigator.serviceWorker.register("worker.js");

    // If there's no active service worker this is the first installation
    if (!registration.active && window.Notification.permission === "granted") {
      new Notification("Ready for offline use", {
        icon: "img/icon192.png",
        badge: "img/icon48-mono.png",
        body: "You can use this web app at any time, even when you're offline.",
        tag: "installed",
      });
    }

    // Subscribe to push
    await window.navigator.serviceWorker.ready;
    subscribeToPushNotifications(registration);

  }
});


})();
