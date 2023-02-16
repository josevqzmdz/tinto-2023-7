<script lang="ts">
    import {
        EnvelopeFill,
        Whatsapp,
        Facebook,
        Instagram,
        Google,
        GeoAltFill,
        TelephoneFill,
    } from "svelte-bootstrap-icons";
</script>

<footer id="contact">
    <header class="header">
        <p class="header-text">Contact Us</p>
    </header>
    <div class="map" />
    <div class="contacts">
        <div class="container">
            <div class="row">
                <div class="col-4">
                    <div class="email contact">
                        <EnvelopeFill width={24} height={24} />
                        abc@def.xyz
                    </div>
                    <div class="whatsapp contact">
                        <Whatsapp width={24} height={24} />
                        abc.def.xyz
                    </div>
                </div>
                <div class="col-4">
                    <div class="facebook contact">
                        <Facebook width={24} height={24} />
                        abc.def.xyz
                    </div>
                    <div class="instagram contact">
                        <Instagram width={24} height={24} />
                        abc.def.xyz
                    </div>
                </div>
                <div class="col-4">
                    <div class="google contact">
                        <Google width={24} height={24} />
                        abc.def.xyz
                    </div>
                    <div class="geo contact">
                        <GeoAltFill width={24} height={24} />
                        abc.def.xyz abc.def.xyz abc.def.xyz
                    </div>
                    <div class="phone contact">
                        <TelephoneFill width={24} height={24} />
                        +9876543210
                    </div>
                </div>
            </div>
            <div
                class="d-flex flex-column flex-sm-row justify-content-between py-4 my-4 border-top"
            >
                <p>© 2022 Company, Inc. All rights reserved.</p>
                <a href="#header">back to the top</a>
                <ul class="list-unstyled d-flex">
                    <li class="ms-3" />
                    <li class="ms-3" />
                    <li class="ms-3" />
                </ul>
            </div>
        </div>
    </div>
</footer>

<style>
    footer {
        height: 100vh;
        background: black;
        color: white;
    }

    header {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: start;
        height: 10vh;
    }

    header > p.header-text {
        color: white;

        font-size: 48px;
        margin: 0;
    }
    .map {
        height: 60vh;
        background: white;
        box-shadow: inset 0px 0px 30px 30px rgba(0, 0, 0, 0.7);
    }
    .contacts {
        height: 30vh;
        display: flex;
        flex-direction: row;
        align-items: end;
        justify-content: center;
    }
    .contact {
        margin: 10px;
    }
</style>
