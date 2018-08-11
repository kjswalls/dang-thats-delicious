import axios from 'axios';
import dompurify from 'dompurify';

function searchResultsHTML(stores) {
  return stores.map((store) => {
    return `
      <a href="/store/${store.slug}" class="search__result">
        <strong>${store.name}</strong>
      </a>
    `;
  })
  .join('');
}

function typeAhead(search) {
  if (!search) return;
  
  const searchInput = search.querySelector('input[name="search"]');
  const searchResults = search.querySelector('.search__results');
  
  searchInput.on('input', function() {
    // if there's no value, hide search results and return
    // like if someone backspaces, we get rid of search results
    if (!this.value) {
      searchResults.style.display = 'none';
      return;
    }

    // update display prop if it was display none before
    searchResults.style.display = 'block';

    axios
      .get(`/api/search?q=${this.value}`)
      .then(res => {
        if (res.data.length) {
          // sanitize html in case user inputs some HTML/JS as like a store name
          // any time we are inserting new HTML like this we want to sanitize it
          // so that bogus stuff doesn't come from any inputs or the database
          searchResults.innerHTML = dompurify.sanitize(searchResultsHTML(res.data));
          return;
        }
        // tell them nothing came back
        // also sanitize in case they enter some HTML in the search field
        searchResults.innerHTML = dompurify.sanitize(`
          <div class="search__result">
            No results for ${this.value} found
          </div>
        `);
      })
      .catch(err => {
        console.error(err);
      });
  });

  // handle keyboard input
  searchInput.on('keyup', (e) => {
    // if they aren't pressing up, down, or enter, skip it
    const keyCodes = [40, 38, 13];
    if (!keyCodes.includes(e.keyCode)) {
      return;
    }
    const activeClass = 'search__result--active';
    const current = search.querySelector(`.${activeClass}`);
    const items = search.querySelectorAll('.search__result');
    let next;

    // pressing down
    if (e.keyCode === 40 && current) {
      next = current.nextElementSibling || items[0];
    // if pressing down and there's no currently selected one
    } else if (e.keyCode === 40) {
      next = items[0];
    // pressing up
    } else if (e.keyCode === 38 && current) {
      next = current.previousElementSibling || items[items.length - 1];
      // if pressing up and there's no currently selected one
    } else if (e.keyCode === 38) {
      next = items[items.length - 1];
    // pressing enter
    } else if (e.keyCode === 13 && current.href) {
      window.location = current.href;
      return; // skip the rest cuz we're navigating
    }

    next.classList.add(activeClass);
    if (current) {
      current.classList.remove(activeClass);
    }
  });
}

export default typeAhead;