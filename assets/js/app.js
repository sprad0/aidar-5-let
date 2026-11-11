/* ============================================================================
   АЙДАР · 5 ЛЕТ — логика приглашения
   Конверт → шарики → приглашение. Без сборщиков и зависимостей.
   ========================================================================== */

(function () {
  'use strict';

  var cfg = window.INVITE_CONFIG || {};
  var body = document.body;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (selector, root) { return (root || document).querySelector(selector); };
  var $$ = function (selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  };

  var MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

  var EVENT_TZ = cfg.timezone || 'Asia/Yakutsk';
  var eventDate = new Date(cfg.eventDate || '2026-11-21T10:00:00+09:00');
  var birthdayDate = new Date(cfg.birthdayDate || '2026-11-16T00:00:00+09:00');

  var partsFormatter = null;
  try {
    partsFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: EVENT_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (error) {
    partsFormatter = null;
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function parts(date) {
    if (!partsFormatter) {
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes()
      };
    }
    var map = {};
    partsFormatter.formatToParts(date).forEach(function (part) {
      if (part.type !== 'literal') map[part.type] = part.value;
    });
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: Number(map.hour) % 24,
      minute: Number(map.minute)
    };
  }

  function dateLabel(date) {
    var p = parts(date);
    return p.day + ' ' + MONTHS_GEN[p.month - 1] + ' ' + p.year;
  }

  function timeLabel(date) {
    var p = parts(date);
    return pad2(p.hour) + ':' + pad2(p.minute);
  }

  function plural(number, forms) {
    var n = Math.abs(number) % 100;
    var n1 = n % 10;
    if (n > 10 && n < 20) return forms[2];
    if (n1 > 1 && n1 < 5) return forms[1];
    if (n1 === 1) return forms[0];
    return forms[2];
  }

  function dayStartInTz(date) {
    var p = parts(date);
    return Date.UTC(p.year, p.month - 1, p.day);
  }

  function daysUntil(date) {
    return Math.round((dayStartInTz(date) - dayStartInTz(new Date())) / 86400000);
  }

  /* --------------------------------------------------------------------------
     Тост и буфер обмена
     ------------------------------------------------------------------------ */
  var toastEl = $('#toast');
  var toastTimer = null;

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 3000);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-1000px';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        area.remove();
      }
    });
  }

  /* ==========================================================================
     КОНВЕРТ — показывается при каждом открытии и перезагрузке страницы
     ========================================================================== */
  var envelopeScreen = $('#envelopeScreen');
  var envelope = $('#openEnvelope');
  var balloonsBox = $('#balloons');
  var isOpened = false;

  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  } catch (error) { /* ignore */ }

  // Никакого «запомнить открытие»: после F5 всё снова начинается с конверта.
  window.scrollTo(0, 0);

  function makeBalloons() {
    if (!balloonsBox || reduceMotion) return;
    if (cfg.effects && cfg.effects.balloons === false) return;

    var colors = ['#e62b2f', '#1c3fa3', '#ffd23f', '#f7f1e3', '#7ce7ff', '#e62b2f', '#1c3fa3'];
    var count = window.innerWidth < 600 ? 12 : 18;
    var html = '';

    for (var i = 0; i < count; i += 1) {
      var x = Math.round((Math.random() - 0.5) * Math.min(window.innerWidth * 0.86, 760));
      var drift = Math.round((Math.random() - 0.5) * 160);
      var size = 38 + Math.round(Math.random() * 38);
      var delay = (Math.random() * 0.35).toFixed(2);
      var duration = (3.1 + Math.random() * 1.5).toFixed(2);
      var color = colors[i % colors.length];

      html += '<span class="balloon" style="--x:' + x + 'px;--drift:' + drift +
        'px;--size:' + size + 'px;--delay:' + delay + 's;--dur:' + duration +
        's;--c:' + color + '"></span>';
    }

    balloonsBox.innerHTML = html;
  }

  function openInvitation() {
    if (isOpened) return;
    isOpened = true;

    if (envelope) envelope.classList.add('is-open');
    if (envelope && envelope.parentElement) envelope.parentElement.classList.add('is-open');
    makeBalloons();

    window.setTimeout(startConfetti, 260);

    window.setTimeout(function () {
      body.classList.add('is-opened');
    }, 760);

    window.setTimeout(function () {
      body.classList.remove('is-locked');
      window.scrollTo(0, 0);
    }, 1280);

    window.setTimeout(function () {
      envelopeScreen.classList.add('is-leaving');
    }, 1550);

    window.setTimeout(function () {
      if (envelopeScreen) {
        envelopeScreen.style.display = 'none';
        envelopeScreen.setAttribute('aria-hidden', 'true');
      }
    }, 2300);
  }

  if (envelope) {
    envelope.addEventListener('click', openInvitation);
  }

  /* ==========================================================================
     КОНФЕТТИ
     ========================================================================== */
  function startConfetti() {
    if (reduceMotion) return;
    if (cfg.effects && cfg.effects.confetti === false) return;

    var canvas = $('#confetti');
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = window.innerWidth;
    var height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var colors = ['#e62b2f', '#1c3fa3', '#ffd23f', '#fffdf7', '#7ce7ff'];
    var pieces = [];
    var count = width < 600 ? 80 : 150;

    for (var i = 0; i < count; i += 1) {
      pieces.push({
        x: width / 2 + (Math.random() - 0.5) * width * 0.55,
        y: height * 0.46 + (Math.random() - 0.5) * height * 0.2,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 13 - 3,
        gravity: 0.17 + Math.random() * 0.13,
        size: 4 + Math.random() * 8,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.34,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() > 0.5 ? 'rect' : 'circle'
      });
    }

    var startedAt = performance.now();
    var duration = 4300;

    function frame(now) {
      var elapsed = now - startedAt;
      var opacity = Math.max(0, 1 - elapsed / duration);
      ctx.clearRect(0, 0, width, height);

      pieces.forEach(function (piece) {
        piece.vy += piece.gravity;
        piece.vx *= 0.995;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.rotation += piece.spin;

        if (opacity <= 0 || piece.y > height + 30) return;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);
        ctx.fillStyle = piece.color;

        if (piece.shape === 'rect') {
          ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, piece.size / 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      if (elapsed < duration) {
        window.requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width, height);
        canvas.width = 0;
        canvas.height = 0;
      }
    }

    window.requestAnimationFrame(frame);
  }

  /* ==========================================================================
     ОБРАТНЫЙ ОТСЧЁТ
     ========================================================================== */
  var countdown = {
    days: $('#cd-days'),
    hours: $('#cd-hours'),
    mins: $('#cd-mins'),
    secs: $('#cd-secs'),
    daysCap: $('#cd-days-cap'),
    hoursCap: $('#cd-hours-cap'),
    minsCap: $('#cd-mins-cap'),
    secsCap: $('#cd-secs-cap'),
    label: $('#countdownLabel'),
    birthdayBadge: $('#birthdayCountdown')
  };

  function setCountdown() {
    if (!countdown.days) return;

    var diff = eventDate.getTime() - Date.now();
    var days;
    var hours;
    var mins;
    var secs;

    if (diff <= 0) {
      days = hours = mins = secs = 0;
    } else {
      days = Math.floor(diff / 86400000);
      hours = Math.floor(diff / 3600000) % 24;
      mins = Math.floor(diff / 60000) % 60;
      secs = Math.floor(diff / 1000) % 60;
    }

    countdown.days.textContent = String(days);
    countdown.hours.textContent = pad2(hours);
    countdown.mins.textContent = pad2(mins);
    countdown.secs.textContent = pad2(secs);

    countdown.daysCap.textContent = plural(days, ['день', 'дня', 'дней']);
    countdown.hoursCap.textContent = plural(hours, ['час', 'часа', 'часов']);
    countdown.minsCap.textContent = plural(mins, ['минута', 'минуты', 'минут']);
    countdown.secsCap.textContent = plural(secs, ['секунда', 'секунды', 'секунд']);

    if (countdown.label) {
      countdown.label.textContent = diff <= 0 ? 'Праздник уже начался' : 'До праздника осталось';
    }

    if (countdown.birthdayBadge) {
      var d = daysUntil(birthdayDate);
      if (d > 0) {
        countdown.birthdayBadge.textContent = 'до дня рождения — ' + d + ' ' + plural(d, ['день', 'дня', 'дней']);
      } else if (d === 0) {
        countdown.birthdayBadge.textContent = 'сегодня Айдару 5 лет!';
      } else {
        countdown.birthdayBadge.textContent = 'Айдару уже 5 лет';
      }
    }
  }

  setCountdown();
  window.setInterval(setCountdown, 1000);

  /* ==========================================================================
     КАЛЕНДАРЬ
     ========================================================================== */
  function renderCalendar() {
    var grid = $('#calGrid');
    if (!grid || isNaN(eventDate.getTime())) return;

    var p = parts(eventDate);
    var year = p.year;
    var month = p.month - 1;
    var partyDay = p.day;

    var b = parts(birthdayDate);
    var birthdayDay = b.month - 1 === month && b.year === year ? b.day : null;

    var firstDay = new Date(Date.UTC(year, month, 1));
    var shift = (firstDay.getUTCDay() + 6) % 7;
    var daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    var html = '';
    var i;

    for (i = 0; i < shift; i += 1) {
      html += '<span class="calendar__day calendar__day--empty" aria-hidden="true"></span>';
    }

    for (i = 1; i <= daysInMonth; i += 1) {
      var classes = 'calendar__day';
      var label = i + ' ' + MONTHS_GEN[month] + ' ' + year;
      var aria = '';

      if (i === birthdayDay) {
        classes += ' calendar__day--birthday';
        label += ' — день рождения Айдара';
        aria = ' aria-label="' + label + '"';
      }
      if (i === partyDay) {
        classes += ' calendar__day--party';
        label += ' — праздник';
        aria = ' aria-label="' + label + '" aria-current="date"';
      }

      html += '<span class="' + classes + '" role="gridcell"' + aria + '>' + i + '</span>';
    }

    grid.innerHTML = html;

    var monthLabel = $('#calMonth');
    if (monthLabel) monthLabel.textContent = MONTHS[month] + ' ' + year;
  }

  renderCalendar();

  /* ==========================================================================
     ДОБАВИТЬ В КАЛЕНДАРЬ
     ========================================================================== */
  function icsDate(date) {
    return date.getUTCFullYear() +
      pad2(date.getUTCMonth() + 1) +
      pad2(date.getUTCDate()) + 'T' +
      pad2(date.getUTCHours()) +
      pad2(date.getUTCMinutes()) +
      pad2(date.getUTCSeconds()) + 'Z';
  }

  function foldIcsLine(line) {
    var encoder = window.TextEncoder ? new TextEncoder() : null;
    var length = function (value) {
      return encoder ? encoder.encode(value).length : value.length;
    };
    var output = '';
    var current = '';
    for (var i = 0; i < line.length; i += 1) {
      var next = current + line.charAt(i);
      if (length(next) > 73 && current) {
        output += current + '\r\n ';
        current = line.charAt(i);
      } else {
        current = next;
      }
    }
    return output + current;
  }

  function icsEscape(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  function downloadCalendar() {
    if (isNaN(eventDate.getTime())) {
      toast('Дата праздника не настроена');
      return;
    }

    var endDate = cfg.eventEnd
      ? new Date(cfg.eventEnd)
      : new Date(eventDate.getTime() + 3 * 3600000);

    var venue = cfg.venue || {};
    var location = [venue.name, venue.address].filter(Boolean).join(', ');
    var description = 'День рождения Айдара — 5 лет! Подробности и анкета гостя: ' +
      window.location.href.split('#')[0];

    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Aidar 5//Birthday Invitation//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + eventDate.getTime() + '@aidar-5',
      'DTSTAMP:' + icsDate(new Date()),
      'DTSTART:' + icsDate(eventDate),
      'DTEND:' + icsDate(endDate),
      'SUMMARY:' + icsEscape(cfg.eventTitle || 'День рождения Айдара — 5 лет!'),
      'LOCATION:' + icsEscape(location),
      'DESCRIPTION:' + icsEscape(description),
      'END:VEVENT',
      'END:VCALENDAR'
    ];

    var blob = new Blob([lines.map(foldIcsLine).join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');

    link.href = url;
    link.download = 'aidar-5-let.ics';
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    toast('Файл с датой праздника скачан');
  }

  ['#icsBtn', '#successIcs'].forEach(function (selector) {
    var button = $(selector);
    if (button) button.addEventListener('click', downloadCalendar);
  });

  /* ==========================================================================
     ПОДЕЛИТЬСЯ
     ========================================================================== */
  function shareInvitation() {
    var data = {
      title: 'Айдар — 5 лет! Приглашение на день рождения',
      text: 'Суперприглашение: ' + dateLabel(eventDate) + ', ' + timeLabel(eventDate) +
        '. Айдару 5 лет!',
      url: window.location.href.split('#')[0]
    };

    if (navigator.share) {
      navigator.share(data).catch(function () { /* пользователь отменил */ });
      return;
    }

    copyText(data.url)
      .then(function () { toast('Ссылка на приглашение скопирована'); })
      .catch(function () { toast('Не удалось скопировать ссылку'); });
  }

  var shareBtn = $('#shareBtn');
  if (shareBtn) shareBtn.addEventListener('click', shareInvitation);

  /* ==========================================================================
     МЕСТО
     ========================================================================== */
  function setupVenue() {
    var venue = cfg.venue || {};
    var mapLink = venue.mapLink || 'https://2gis.ru/';
    var waPhone = String((cfg.rsvp && cfg.rsvp.whatsapp) || '').replace(/\D/g, '');

    if (waPhone) {
      $$('a[href*="wa.me/"]').forEach(function (link) {
        link.setAttribute('href', 'https://wa.me/' + waPhone);
      });
    }

    if (venue.phone) {
      $$('a[href^="tel:"]').forEach(function (link) {
        link.setAttribute('href', 'tel:' + venue.phone.replace(/[^\d+]/g, ''));
      });
    }

    ['#mapLink', '#mapCard', '#footerMap'].forEach(function (selector) {
      var el = $(selector);
      if (el) el.setAttribute('href', mapLink);
    });

    var venueAddress = $('#venueAddress');
    if (venueAddress && venue.address) venueAddress.textContent = venue.address;

    var phone = $('#venuePhone');
    if (phone && venue.phone) {
      phone.setAttribute('href', 'tel:' + venue.phone.replace(/[^\d+]/g, ''));
      phone.textContent = venue.phone;
    }

    if (venue.mapEmbed) {
      var card = $('#mapCard');
      if (card) {
        var box = document.createElement('div');
        box.className = 'map-card map-card--embed';
        box.innerHTML =
          '<iframe src="' + String(venue.mapEmbed).replace(/"/g, '&quot;') +
          '" title="Карта 2ГИС" loading="lazy" allowfullscreen></iframe>' +
          '<a class="map-card__badge" href="' + String(mapLink).replace(/"/g, '&quot;') +
          '" target="_blank" rel="noopener"><span class="map-card__logo">2ГИС</span>' +
          '<span>Открыть карту</span></a>';
        card.replaceWith(box);
      }
    }
  }

  setupVenue();

  var copyAddressBtn = $('#copyAddress');
  if (copyAddressBtn) {
    copyAddressBtn.addEventListener('click', function () {
      var address = (cfg.venue && cfg.venue.address) || '';
      if (!address) return;
      copyText(address)
        .then(function () { toast('Адрес скопирован'); })
        .catch(function () { toast('Не удалось скопировать адрес'); });
    });
  }

  /* ==========================================================================
     АНКЕТА → WHATSAPP
     ========================================================================== */
  var form = $('#rsvpForm');
  var successBox = $('#rsvpSuccess');
  var successTitle = $('#successTitle');
  var successText = $('#successText');
  var successWa = $('#successWa');
  var submitBtn = $('#submitBtn');
  var submitLabel = submitBtn ? submitBtn.querySelector('span') : null;
  var comingFields = $('#comingFields');
  var giftSelect = $('#fGift');
  var giftOtherField = $('#giftOtherField');

  function clearErrors() {
    if (!form) return;
    $$('.field__error', form).forEach(function (el) { el.textContent = ''; });
    $$('.is-invalid', form).forEach(function (el) { el.classList.remove('is-invalid'); });
  }

  function setError(id, message) {
    var el = $('#error' + id);
    if (el) el.textContent = message;
  }

  function selectedAttendance() {
    var input = form ? form.querySelector('input[name="attendance"]:checked') : null;
    return input ? input.value : '';
  }

  function toggleAttendanceFields() {
    if (!form) return;
    var value = selectedAttendance();
    if (comingFields) comingFields.hidden = value !== 'Приду';
  }

  function toggleGiftOther() {
    if (!giftOtherField) return;
    giftOtherField.hidden = !giftSelect || giftSelect.value !== 'Свой вариант подарка';
  }

  if (form) {
    $$('input[name="attendance"]', form).forEach(function (input) {
      input.addEventListener('change', function () {
        toggleAttendanceFields();
        setError('Attendance', '');
      });
    });

    if (giftSelect) {
      giftSelect.addEventListener('change', toggleGiftOther);
    }

    var nameInput = $('#fName');
    if (nameInput) {
      nameInput.addEventListener('input', function () {
        this.classList.remove('is-invalid');
        setError('Name', '');
      });
    }

    toggleAttendanceFields();
    toggleGiftOther();
  }

  function collectPayload() {
    return {
      name: ($('#fName') || {}).value ? $('#fName').value.trim() : '',
      attendance: selectedAttendance(),
      adults: ($('#fAdults') || {}).value || '',
      kids: ($('#fKids') || {}).value || '',
      guest: ($('#fGuest') || {}).value ? $('#fGuest').value.trim() : '',
      food: ($('#fFood') || {}).value ? $('#fFood').value.trim() : '',
      gift: ($('#fGift') || {}).value || '',
      giftOther: ($('#fGiftOther') || {}).value ? $('#fGiftOther').value.trim() : '',
      wish: ($('#fWish') || {}).value ? $('#fWish').value.trim() : '',
      contact: ($('#fContact') || {}).value ? $('#fContact').value.trim() : ''
    };
  }

  function buildMessage(payload) {
    var lines = [
      '🕸️ Анкета гостя · День рождения Айдара — 5 лет',
      '🕸️ ' + dateLabel(eventDate) + ', ' + timeLabel(eventDate),
      '',
      '🕸️ Имя: ' + payload.name,
      (payload.attendance === 'Приду' ? '🕸️ Ответ: Приду' : '🕸️ Ответ: К сожалению, не смогу')
    ];

    if (payload.attendance === 'Приду') {
      lines.push('🕸️ Взрослых: ' + payload.adults);
      lines.push('🕸️ Детей: ' + payload.kids);
      if (payload.guest) lines.push('🕸️ Кого ждём: ' + payload.guest);
      if (payload.food) lines.push('🕸️ Питание/аллергии: ' + payload.food);
      if (payload.gift === 'Свой вариант подарка') {
        if (payload.giftOther) lines.push('🕸️ Подарок: ' + payload.giftOther);
      } else if (payload.gift) {
        lines.push('🕸️ Планируемый подарок: ' + payload.gift);
      }
    }
    if (payload.wish) lines.push('🕸️ Пожелание Айдару: ' + payload.wish);
    if (payload.contact) lines.push('🕸️ Контакт: ' + payload.contact);

    lines.push('');
    lines.push('Отправлено с сайта-приглашения');
    return lines.join('\n');
  }

  function waUrl(message) {
    var phone = String((cfg.rsvp && cfg.rsvp.whatsapp) || '79220172467').replace(/\D/g, '');
    return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
  }

  function showSuccess(payload, url) {
    if (!successBox || !form) return;

    form.hidden = true;
    successBox.hidden = false;

    var firstName = payload.name.split(/\s+/)[0] || payload.name;
    successTitle.textContent = 'Спасибо, ' + firstName + '!';

    if (payload.attendance === 'Не смогу') {
      successText.textContent = 'Жаль, что не получится. Спасибо, что сообщили — Айдар обязательно увидится с вами в другой раз.';
    } else {
      successText.textContent = 'Мы открыли WhatsApp с готовым ответом. Осталось нажать «Отправить» — и ждём вас ' +
        dateLabel(eventDate) + ' в ' + timeLabel(eventDate) + '!';
    }

    if (successWa) successWa.href = url;

    try {
      localStorage.setItem('aidarRsvp', JSON.stringify(payload));
    } catch (error) { /* приватный режим */ }

    window.setTimeout(function () {
      successBox.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }, 80);
  }

  function resetSubmitButton() {
    if (!submitBtn) return;
    submitBtn.disabled = false;
    if (submitLabel) submitLabel.textContent = 'Отправить в WhatsApp';
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearErrors();

      var nameInput = $('#fName');
      var name = nameInput ? nameInput.value.trim() : '';
      var attendance = selectedAttendance();
      var valid = true;

      if (name.length < 2) {
        if (nameInput) nameInput.classList.add('is-invalid');
        setError('Name', 'Напишите, пожалуйста, ваше имя');
        valid = false;
      }

      if (!attendance) {
        setError('Attendance', 'Выберите, пожалуйста, один из вариантов');
        valid = false;
      }

      if (!valid) {
        var firstInvalid = $('.is-invalid', form) || form.querySelector('input[name="attendance"]');
        if (firstInvalid && firstInvalid.focus) {
          firstInvalid.focus();
          firstInvalid.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        }
        return;
      }

      var payload = collectPayload();
      var message = buildMessage(payload);
      var url = waUrl(message);

      if (submitBtn) {
        submitBtn.disabled = true;
        if (submitLabel) submitLabel.textContent = 'Открываем WhatsApp…';
      }

      var opened = null;
      try {
        opened = window.open(url, '_blank');
        if (opened) opened.opener = null;
      } catch (error) {
        opened = null;
      }

      if (!opened) {
        // Если браузер заблокировал новое окно — не теряем ответ: даём кнопку ниже.
        toast('Если WhatsApp не открылся, нажмите «Открыть WhatsApp ещё раз».');
      }

      showSuccess(payload, url);
      resetSubmitButton();
    });
  }

  var editAnswerBtn = $('#editAnswer');
  if (editAnswerBtn) {
    editAnswerBtn.addEventListener('click', function () {
      if (!successBox || !form) return;
      successBox.hidden = true;
      form.hidden = false;
      resetSubmitButton();
      form.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  }

  /* ==========================================================================
     ЛАЙТБОКС
     ========================================================================== */
  var galleryItems = $$('.gallery__item');
  var lightbox = $('#lightbox');
  var lightboxImage = $('#lbImage');
  var lightboxCaption = $('#lbCaption');
  var lightboxClose = $('#lbClose');
  var lightboxPrev = $('#lbPrev');
  var lightboxNext = $('#lbNext');
  var lightboxIndex = 0;

  function showPhoto(index) {
    if (!galleryItems.length || !lightbox) return;
    lightboxIndex = (index + galleryItems.length) % galleryItems.length;
    var item = galleryItems[lightboxIndex];
    var image = item.querySelector('img');

    lightboxImage.src = image.getAttribute('src');
    lightboxImage.alt = image.getAttribute('alt') || '';
    lightboxCaption.textContent = item.getAttribute('data-caption') || image.getAttribute('alt') || '';
  }

  function openLightbox(index) {
    if (!lightbox) return;
    showPhoto(index);
    lightbox.hidden = false;
    body.classList.add('no-scroll');
    if (lightboxClose) lightboxClose.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    body.classList.remove('no-scroll');
    lightboxImage.src = '';
  }

  galleryItems.forEach(function (item, index) {
    item.addEventListener('click', function () { openLightbox(index); });
  });

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxPrev) lightboxPrev.addEventListener('click', function () { showPhoto(lightboxIndex - 1); });
  if (lightboxNext) lightboxNext.addEventListener('click', function () { showPhoto(lightboxIndex + 1); });

  if (lightbox) {
    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener('keydown', function (event) {
    if (!lightbox || lightbox.hidden) return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') showPhoto(lightboxIndex - 1);
    if (event.key === 'ArrowRight') showPhoto(lightboxIndex + 1);
  });

  /* ==========================================================================
     МОБИЛЬНОЕ МЕНЮ
     ========================================================================== */
  var burger = $('#burger');
  var mobileMenu = $('#mobileMenu');

  function closeMenu() {
    if (!burger || !mobileMenu) return;
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Открыть меню');
    mobileMenu.classList.remove('is-open');
    mobileMenu.setAttribute('aria-hidden', 'true');
    body.classList.remove('no-scroll');
  }

  if (burger && mobileMenu) {
    burger.addEventListener('click', function () {
      var isOpen = burger.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closeMenu();
      } else {
        burger.setAttribute('aria-expanded', 'true');
        burger.setAttribute('aria-label', 'Закрыть меню');
        mobileMenu.classList.add('is-open');
        mobileMenu.setAttribute('aria-hidden', 'false');
        body.classList.add('no-scroll');
      }
    });

    $$('a', mobileMenu).forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && mobileMenu.classList.contains('is-open')) closeMenu();
    });
  }

  /* ==========================================================================
     ШАПКА
     ========================================================================== */
  var topbar = $('#topbar');

  function onScroll() {
    if (!topbar) return;
    if (window.scrollY > 40) topbar.classList.add('is-scrolled');
    else topbar.classList.remove('is-scrolled');
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ==========================================================================
     ПОЯВЛЕНИЕ БЛОКОВ
     ========================================================================== */
  var revealItems = $$('.reveal');

  if ('IntersectionObserver' in window && !reduceMotion) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    revealItems.forEach(function (item) {
      var parent = item.parentElement;
      if (parent) {
        var siblings = Array.prototype.filter.call(parent.children, function (child) {
          return child.classList.contains('reveal');
        });
        var order = siblings.indexOf(item);
        if (order > 0) item.style.setProperty('--d', String(Math.min(order, 6)));
      }
      observer.observe(item);
    });
  } else {
    revealItems.forEach(function (item) { item.classList.add('is-visible'); });
  }

  /* ==========================================================================
     МЕЛОЧИ
     ========================================================================== */
  // Плавный скролл с учётом фиксированной шапки для браузеров без scroll-behavior.
  if (!('scrollBehavior' in document.documentElement.style)) {
    $$('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        var hash = link.getAttribute('href');
        if (!hash || hash.length < 2) return;
        var target = document.querySelector(hash);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView();
      });
    });
  }
})();
