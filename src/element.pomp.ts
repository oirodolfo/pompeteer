import { ClickOptions, ElementHandle, Page } from "puppeteer";
import { PompTimeoutError, waitFor } from "./waitFor";

/** A custom reusable element class with nesting capabilities.
 * Use as the building block of your POMs and to extend element interactions.
 */
export class PompElement {
  constructor(
    public page: Page,
    /** Function to locate and retrieve the wrapped element */
    public fetch: (timeout?: number) => Promise<ElementHandle<Element>>
  ) {}

  /** A utility method to check the existance of the element on the page, will not throw an error */
  async exists(timeout: number) {
    try {
      return !!(await this.fetch(timeout));
    } catch {
      return false;
    }
  }

  /** A shorthand for fetching and clicking the element */
  async click(options?: ClickOptions) {
    const el = await this.fetch();
    await el.click(options);
  }

  /** A shorthand for fetching and clicking the element via JS's click() function */
  async jsClick() {
    const el = await this.fetch();
    await el.evaluate((e) => (e as HTMLElement).click());
  }

  /** A shorthand for retrieving the list of the element's classes */
  get classes() {
    return this.fetch().then((el) =>
      el
        .getProperty("className")
        .then((className) => className.jsonValue<string>())
        .then((value) => value.split(" "))
    );
  }

  /** A shorthand for retrieving a map of the element's styles */
  get styles() {
    return this.fetch().then((el) =>
      el.evaluate((e) => JSON.parse(JSON.stringify(getComputedStyle(e))))
    );
  }

  /** A shorthand for retrieving the element's text content */
  get text() {
    return this.fetch()
      .then((el) => el.getProperty("textContent"))
      .then((prop) => prop.jsonValue<string>())
      .then((text) => text.trim());
  }

  /** A shorthand for retrieving an attribute of the element */
  async getAttr(attr: string) {
    return (await this.fetch()).evaluate(
      (el, attr: string) => el.getAttribute(attr),
      [attr]
    );
  }

  /** A single sub-element xpath selector.
   * To look through descendants the selector must begin with .//.
   * Be mindful of Puppeteer's xpath support.
   */
  $x<T extends PompElement = PompElement>(
    /** The xpath selector */
    selector: string,
    /** A custom element class */
    Type?: new (
      page: Page,
      fetch: (timeout?: number) => Promise<ElementHandle<Element>>
    ) => T
  ): T {
    const fetcher = async (timeout?: number) => {
      const self = await this.fetch();
      const el = await waitFor<ElementHandle<Element>>(
        this.page,
        async () => {
          const els = await self.$x(selector);
          return els?.[0];
        },
        timeout
      );
      if (!el) {
        throw new PompTimeoutError(this.page, selector, timeout);
      }
      return el;
    };
    return Type ? new Type(this.page, fetcher) : (new PompElement(this.page, fetcher) as T);
  }

  /** A sub-element collection xpath selector.
   * To look through descendants the selector must begin with .//.
   * Be mindful of Puppeteer's xpath support.
   */
  $$x<T extends PompElement = PompElement>(
    /** The xpath selector */
    selector: string,
    /** A custom element class */
    Type?: new (
      page: Page,
      fetch: (timeout?: number) => Promise<ElementHandle<Element>>
    ) => T
  ): PompElementCollection<T> {
    const fetcher = async (timeout?: number) => {
      const self = await this.fetch();
      await waitFor<ElementHandle<Element>>(
        this.page,
        async () => {
          const els = await self.$x(selector);
          return els[0];
        },
        timeout
      );
      const el = self.$x(selector);
      if (!el) {
        throw new PompTimeoutError(this.page, selector, timeout);
      }
      return el;
    };
    return new PompElementCollection<T>(this.page, fetcher, Type);
  }

  /** A single sub-element css selector. */
  $<T extends PompElement = PompElement>(
    /** The css selector */
    selector: string,
    /** A custom element class */
    Type?: new (
      page: Page,
      fetch: (timeout?: number) => Promise<ElementHandle<Element>>
    ) => T
  ): T {
    const fetcher = async (timeout?: number) => {
      const self = await this.fetch();
      return self.waitForSelector(selector, { timeout }) as Promise<
        ElementHandle<Element>
      >;
    };
    return Type ? new Type(this.page, fetcher) : (new PompElement(this.page, fetcher) as T);
  }

  /** A sub-element collection css selector. */
  $$<T extends PompElement = PompElement>(
    /** The css selector */
    selector: string,
    /** A custom element class */
    Type?: new (
      page: Page,
      fetch: (timeout?: number) => Promise<ElementHandle<Element>>
    ) => T
  ): PompElementCollection<T> {
    const fetcher = async (timeout?: number) => {
      const self = await this.fetch();
      await self.waitForSelector(selector, { timeout }).catch(() => {});
      const els = await self.$$(selector);
      return els;
    };
    return new PompElementCollection<T>(this.page, fetcher, Type);
  }
}

/** A collection of elements with some utility methods.
 * For situations when a page has a list of repeating components.
 */
export class PompElementCollection<T extends PompElement = PompElement> {
  /** Function to locate and retrieve all matching elements */
  fetch: (timeout?: number) => Promise<T[]>;

  constructor(
    public page: Page,
    /** Function to locate and retrieve all matching element handlers */
    collectionFetcher: (timeout?: number) => Promise<ElementHandle<Element>[]>,
    /** Custom element class of the underlying items */
    Type?: new (page: Page, fetch: () => Promise<ElementHandle<Element>>) => T
  ) {
    this.fetch = async (timeout?: number) => {
      const collection = await collectionFetcher(timeout);
      return collection.map((el) => {
        const fetcher = () => Promise.resolve(el);
        return Type
          ? new Type(this.page, fetcher)
          : (new PompElement(this.page, fetcher) as T);
      });
    };
  }

  /** Utility function to retrieve the first matching element from the collection */
  async find(predicate: (value: T) => Promise<boolean> | boolean) {
    const els = await this.fetch();
    for (const el of els) {
      const found = await predicate(el);
      if (found) {
        return el;
      }
    }
    return undefined;
  }

  /** Utility function to retrieve all matching elements from the collection */
  async filter(predicate: (value: T) => Promise<boolean>) {
    const els = await this.fetch();
    const validations = await Promise.all(
      els.map(async (el) => ({ el, isValid: await predicate(el) }))
    );
    return validations.filter(({ isValid }) => isValid).map(({ el }) => el);
  }
}
