<script lang="ts">
  import { onMount } from 'svelte';
  import type { ICard } from '../../types';
  import { validateDate } from '../citeFormatters';
  import type { Writable } from 'svelte/store';
  import { getContext } from 'svelte';
  import type { EditHistory } from '../history';

  export let key: string;
  const card: Writable<ICard> = getContext('card');
  const history: EditHistory = getContext('history');

  let validMonth: boolean;
  let validDay: boolean;
  let validYear: boolean;

  let month: string = $card[key].month;
  let day: string = $card[key].day;
  let year: string = $card[key].year;

  function cleanInput(string: string) {
    // remove all non-numbers
    if (string == null) {
      return string;
    }
    return string.replace(/\D/g, '');
  }
  function updateDate() {
    history.action('editDate', {
      key: key,
      date: {
        month: month,
        day: day,
        year: year,
      },
    });
  }
  function monthChange() {
    month = cleanInput(month);
    updateDate();
  }
  $: month, monthChange();
  function dayChange() {
    day = cleanInput(day);
    updateDate();
  }
  $: day, dayChange();
  function yearChange() {
    year = cleanInput(year);
    updateDate();
  }
  $: year, yearChange();

  function validate() {
    let valid = validateDate($card[key]);
    validMonth = valid.month;
    validDay = valid.day;
    validYear = valid.year;
    month = $card[key].month;
    day = $card[key].day;
    year = $card[key].year;
  }
  $: $card[key], validate();

  let monthInput: HTMLElement;
  let dayInput: HTMLElement;
  let yearInput: HTMLElement;
  onMount(function () {
    monthInput.focus();
  });
  function monthKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === '/') {
      e.preventDefault();
      dayInput.focus();
    }
  }
  function dayKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === '/') {
      e.preventDefault();
      yearInput.focus();
    }
  }
</script>

<div class="top">
  <input
    type="text"
    class:invalid={!validMonth}
    bind:value={month}
    placeholder={'Month'}
    bind:this={monthInput}
    on:keydown={monthKeydown}
    on:blur={() => history.preventExtension()}
  />
  <input
    type="text"
    class:invalid={!validDay}
    bind:value={day}
    placeholder={'Date'}
    bind:this={dayInput}
    on:keydown={dayKeydown}
    on:blur={() => history.preventExtension()}
  />
  <input
    type="text"
    class:invalid={!validYear}
    bind:value={year}
    placeholder={'Year'}
    bind:this={yearInput}
    on:blur={() => history.preventExtension()}
  />
</div>

<style>
  div.top {
    position: relative;
    width: 100%;
    height: auto;
    font-size: 1rem;
    font-weight: normal;
    display: flex;
    flex-direction: row;
    gap: var(--padding);
  }
  input {
    border: none;
    outline: none;
    display: block;
    box-sizing: border-box;
    position: relative;
    width: 33.33%;
    font-size: inherit;
    font-weight: inherit;
    font-family: inherit;
    border-radius: var(--padding);
    padding: var(--padding);
    background: var(--background-select-weak-secondary);
    color: var(--text);
    transition: background var(--transition-duration);
  }
  input.invalid {
    background: var(--background-error-weak-secondary);
  }
  input::placeholder {
    color: var(--text-weak);
  }
  input.invalid::placeholder {
    color: var(--text-error-weak);
  }
  input:focus {
    background: var(--background-select-secondary);
    color: var(--text-strong);
  }
  input.invalid:focus {
    background: var(--background-error-secondary);
  }
</style>
