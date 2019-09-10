import { urlBase64ToUint8Array } from "./helpers.js";

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


// DOM elements
const hamburgerButton      = document.querySelector(".header__hamburger a");
const installButton        = document.querySelector(".install");
const swStatus             = document.querySelector(".swstatus");
const overlay              = document.querySelector(".overlay");
const travelCurrencyInput  = document.querySelector(".currency__select--travel");
const homeCurrencyInput    = document.querySelector(".currency__select--home");
const travelAmountInput    = document.querySelector(".amount__input--travel");
const travelCurrencyOutput = document.querySelector(".amount__currency--travel");
const homeAmountOutput     = document.querySelector(".amount__output--home");
const homeCurrencyOutput   = document.querySelector(".amount__currency--home");
const refreshButton        = document.querySelector(".refresh");
const notificationCheckbox = document.querySelector(".notifications");


// Create option elements for the select elements from the currencies
const createOptionElements = (currencies) => {
  return Array.from(currencies, ([ code, { name } ]) => {
    const element = document.createElement("option");
    element.innerHTML = `${name} (${code})`;
    element.value = code;
    return element;
  });
}


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

hamburgerButton.addEventListener("click", () => {
  (sidebarOpened) ? closeSidebar() : openSidebar();
});

overlay.addEventListener("click", () => {
  (sidebarOpened) ? closeSidebar() : null;
});

// Detect either the absence of the service worker API or a web page that's not
// served from a secure or local origin
if (!window.navigator.serviceWorker || !window.navigator.serviceWorker.ready) {
  const { host, protocol } = window.location;
  const reason = (host.startsWith("localhost") === false || protocol !== "https:")
    ? `The web page is not secure or served from a non-localhost origin.`
    : `You appear to be using an ancient browser.`;
  throw new Error(`Service Worker API non-functional! ${ reason }`);
}


// =======================================================
// Your code goes here! (and maybe into a service worker?)
// =======================================================


// Display the app when ready
// document.body.classList.add("loaded");


// For mobile Safari :(
const supportsNotifications = "Notification" in window;


// Save and restore the last inputs from local storage

localforage.config({ name: "monie", storeName: "cache", });

const saveInput = async (travelCurrency, homeCurrency, travelAmount) => {
  const latestInput = { travelCurrency, homeCurrency, travelAmount };
  return await localforage.setItem("input", latestInput);
}

const saveNotificationState = async (state) => {
  return await localforage.setItem("notifications", state);
}

const restoreInput = async () => {
  let [ input, notifications ] = await Promise.all([
    localforage.getItem("input"),
    localforage.getItem("notifications"),
  ]);
  // Use default values if nothing has been stored so far
  input = input || {
    travelCurrency: "GBP",
    homeCurrency: "EUR",
    travelAmount: 100,
  };
  if (typeof notifications !== "boolean") {
    notifications = (supportsNotifications)
      ? window.Notification.permission === "granted"
      : false;
  }
  return { ...input, notifications };
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


// true or false if the user has made a manual choice regarding notifications
// in the app ui, undefined otherwise. Only changed by setNotificationsState()
let notificationsEnabled;


const setNotificationsState = async (value, postToWorker = true) => {
  if (!supportsNotifications) {
    return;
  }
  const permission = window.Notification.permission;
  notificationsEnabled = value;
  if (postToWorker && "serviceWorker" in window.navigator) {
    const registration = await window.navigator.serviceWorker.getRegistration();
    if (registration.active) {
      registration.active.postMessage({
        type: "SET_NOTIFICATION_PERMISSIONS",
        payload: value,
      });
    }
  }
  await saveNotificationState(value);
  notificationCheckbox.checked = (value && permission === "granted");
}


// Handle a click on the refresh link
const handleRefreshClick = async () => {
  if (supportsNotifications && window.Notification.permission === "default") {
    const permission = await window.Notification.requestPermission();
    const permissionGranted = permission === "granted";
    setNotificationsState(permissionGranted);
  }
  if (!refreshButton.classList.contains("refresh--working")) {
    refreshButton.classList.add("refresh--working");
    try {
      return getRates({ refresh: true });
    } finally {
      refreshButton.classList.remove("refresh--working");
    }
  }
};

// The boolean returned from this function indicates if the operation related
// to the checkbox was successful
const handleNotificationCheckboxChange = async (event) => {
  if (!supportsNotifications) {
    return false;
  }
  if (event.target.checked) {
    const permission = await window.Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsState(true);
      const registration = await window.navigator.serviceWorker.ready;
      const subscribed = await subscribeToPushNotifications(registration);
      if (!subscribed) {
        console.error("Failed to register for push notifications");
      }
      return true;
    } else {
      setNotificationsState(false);
      return false;
    }
  } else {
    setNotificationsState(false);
    if (pushSubscription) {
      await pushSubscription.unsubscribe();
    }
  }
  return true;
};


// Subscribe to messages from the service worker
if ("serviceWorker" in window.navigator) {
  window.navigator.serviceWorker.addEventListener("message", (evt) => {

    // Recieved a push notification that new rates are available
    if (evt.data.type === "NEW_RATES") {
      const newRates = evt.data.payload;
      applyChanges(calculateRates(newRates));
    }

    // Recieved a status message with the service worker version
    if (evt.data.type === "STATUS_INFO") {
      const version = evt.data.payload.version;
      const statusMessage = `Installed version: <b>${ version }</b>`;
      swStatus.innerHTML = statusMessage;
    }

  });
}


const init = (rates, lastInput) => {

  // Set the inputs and selects to the last saved state
  travelCurrencyInput.value = lastInput.travelCurrency;
  homeCurrencyInput.value = lastInput.homeCurrency;
  travelAmountInput.value = lastInput.travelAmount;
  setNotificationsState(lastInput.notifications, false);

  // If notifications are not supported, disable and uncheck the checkbox
  if (!supportsNotifications) {
    notificationCheckbox.setAttribute("disabled", true);
    notificationCheckbox.checked = false;
    notificationCheckbox.parentElement.classList.add("not-supported");
  }

  // If notification permissions have been denied, disable and uncheck
  // the checkbox
  if (supportsNotifications && window.Notification.permission === "denied") {
    notificationCheckbox.setAttribute("disabled", true);
    notificationCheckbox.checked = false;
    notificationCheckbox.parentElement.classList.add("disabled");
  }

  // Notify the service worker about current notification state and register a
  // push subscription if notifications are allowed
  window.navigator.serviceWorker.ready.then( async (registration) => {
    if (supportsNotifications
      && window.Notification.permission === "granted"
      && lastInput.notifications
    ) {
      await subscribeToPushNotifications(registration);
    }
    if (registration.active) {
      registration.active.postMessage({
        type: "SET_NOTIFICATION_PERMISSIONS",
        payload: lastInput.notifications,
      });
    }
  });

  // Calculate and display the rates for the first time
  applyChanges(calculateRates(rates));

  // Setup event handlers for inputs and selects
  const handler = () => applyChanges(calculateRates(rates));
  const elements = [ travelCurrencyInput, homeCurrencyInput, travelAmountInput ];
  const events = [ "keyup", "click", "change" ];
  for (const element of elements) {
    for (const event of events) {
      element.addEventListener(event, handler);
    }
  }

  // Enable rate refresh
  refreshButton.addEventListener("click", async (evt) => {
    const newRates = await handleRefreshClick();
    applyChanges(calculateRates(newRates));
  });

  // Notification checkbox
  notificationCheckbox.addEventListener("change", async (event) => {
    const success = await handleNotificationCheckboxChange(event);
    if (!success) {
      notificationCheckbox.checked = !notificationCheckbox.checked;
    }
  });

  // Display the app
  document.body.classList.add("loaded");

}

// Initialize with the rates and data from the cache
Promise.all([ getRates({ refresh: false }), restoreInput() ])
  .then( ([ rates, lastInput ]) => init(rates, lastInput) )
  .catch( (o_O) => {
    window.alert(o_O);
    console.error(o_O);
  });

let pushSubscription;

// Subscribe to push notifications
const subscribeToPushNotifications = async (registration) => {
  if (pushSubscription) {
    return true; // a subscription is already registered
  }
  try {
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array("BJA61PkUXQzJPj22WQs7C8Vrqu20YKFDEahjbYvs7E4LoyxZHabDTP_NgBxA1PGhJjyM8Le9RNZ_lqygcodNEiQ"),
      });
    }
    const { key, authSecret, endpoint } = getSubscriptionInfo(subscription);
    await postSubscripionInfo({ key, authSecret, endpoint });
    console.info("Registered to recieve push notifications");
    pushSubscription = subscription;
    return true;
  } catch (err) {
    console.info(`Failed to register for push notifications: ${err}`);
    return false;
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

// Wait for the installation to become possible and then show a nice install
// button in the sidebar in addition to the regular install prompt
window.addEventListener("beforeinstallprompt", async (evt) => {
  installButton.disabled = false;
  installButton.classList.remove("install--inactive");
  installButton.addEventListener("click", () => {
    evt.prompt();
    installButton.disabled = true;
  });
}, { once: true });

// Hide the install button once the app has been installed (either via the
// install button or the native prompt)
window.addEventListener("appinstalled", () => {
  installButton.classList.add("install--inactive");
});

// Launch the service worker and subscribe to push notifications notifications once
// everything else is done
window.addEventListener("load", async () => {
  if ("serviceWorker" in window.navigator) {

    const registration = await window.navigator.serviceWorker.register("worker.js");

    // If there's no active service worker this is the first installation
    if (!registration.active && window.Notification.permission === "granted") {
      new Notification("Ready for offline use", {
        icon: "img/icon192.png",
        badge: "img/badge.png",
        body: "You can use this web app at any time, even when you're offline.",
        tag: "installed",
      });
    }

    // Request status info from the active registration
    if (registration.active) {
      registration.active.postMessage({ type: "REQUEST_STATUS_INFO" });
    }

  }
});
