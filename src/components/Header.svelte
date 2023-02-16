<script>
    import { List } from "svelte-bootstrap-icons";
    let dropdown_visible = false;
    function handleMouseClick(event) {
        dropdown_visible = true;
    }
    function handleBackgroundMouseClick(event) {
        dropdown_visible = false;
    }
    function handleBackgroundKeyboardClick(event) {
        if (event.key == "Escape") dropdown_visible = false;
    }
</script>

<header id="header">
    <div class="container-fluid">
        <nav>
            <button
                on:click={handleMouseClick}
                class="dropdown_toggle"
                type="button"
            >
                <List style="color: white" width={36} height={36} />
            </button>
            <ul
                on:click={handleBackgroundMouseClick}
                on:keypress={handleBackgroundKeyboardClick}
                class="dropdown_menu {dropdown_visible
                    ? 'dropdown_visible'
                    : 'dropdown_invisible'}"
            >
                <li><a class="dropdown_item" href="#home">Home</a></li>
                <li><a class="dropdown_item" href="#about">About Us</a></li>
                <li><a class="dropdown_item" href="#features">Features</a></li>
                <li><a class="dropdown_item" href="#contact">Contact Us</a></li>
            </ul>
        </nav>

        <div class="company-name">
            <div class="company-logo">
                <img src="/static/logo.png" alt="logo" class="rounded" />
            </div>
            <div class="company-title">
                <p>La tinto Mendez</p>
            </div>
        </div>
    </div>
</header>

<style>
    header > div.container-fluid > nav > button {
        background: none;
        border: none;
    }

    .dropdown_invisible {
        display: none !important;
    }
    .dropdown_visible {
        display: flex !important;
    }
    ul.dropdown_menu {
        align-items: start;
        background: linear-gradient(to right, black, #ffffff3b);
        display: flex;
        flex-direction: column;
        height: 100%;
        justify-content: center;
        left: 0;
        padding: 50px;
        position: absolute;
        top: 0;
        width: 100%;
        z-index: 999;
    }

    .dropdown_item {
        color: white;
        font-size: 36px;
        text-decoration: none;
    }
    header {
        display: flex;
        flex-direction: row;
        align-content: center;
        align-items: center;
        justify-content: center;
    }

    header > .container-fluid {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
    }

    header > .container-fluid > nav {
        width: 36px;
    }
    header > .container-fluid > .company-name {
        width: 100%;
    }

    header,
    div.container-fluid,
    div.company-name {
        height: 4vh;
    }

    div.company-logo {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
    }
    div.company-logo > img {
        height: 3vh;
        margin-right: 5px;
    }

    div.company-name {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
    }
    div.company-name > div.company-title > p {
        color: white;
        font-size: 24px;
        margin: 0;
        padding: 0;
    }
</style>
